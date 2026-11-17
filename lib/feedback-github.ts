import "server-only";

type ReportForIssue = {
  id: string;
  title: string;
  description: string;
  expected: string | null;
  observed: string | null;
  steps: string | null;
  pagePath: string | null;
  userName: string;
  userEmail: string;
  deviceInfo: string | null;
};

export type GitHubIssueResult =
  | { state: "CREATED"; number: number; url: string }
  | { state: "PENDING" | "FAILED"; note: string };

let cachedInstallationToken:
  | { repository: string; token: string; expiresAt: number }
  | undefined;

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function der(tag: number, content: Uint8Array): Uint8Array {
  const lengthBytes: number[] = [];
  if (content.length < 128) {
    lengthBytes.push(content.length);
  } else {
    let length = content.length;
    while (length > 0) {
      lengthBytes.unshift(length & 0xff);
      length >>>= 8;
    }
    lengthBytes.unshift(0x80 | lengthBytes.length);
  }
  return concatBytes(Uint8Array.of(tag, ...lengthBytes), content);
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function privateKeyDer(pem: string): Uint8Array {
  const normalized = pem.replace(/\\n/g, "\n").trim();
  const encoded = normalized
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s/g, "");
  const key = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));

  if (normalized.includes("BEGIN PRIVATE KEY")) return key;
  if (!normalized.includes("BEGIN RSA PRIVATE KEY")) {
    throw new Error("Unsupported GitHub App private-key format.");
  }

  // GitHub downloads PKCS#1 RSA keys; WebCrypto imports PKCS#8, so wrap the
  // original RSA key in the standard PKCS#8 container before importing it.
  const rsaEncryption = Uint8Array.of(
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
  );
  return der(0x30, concatBytes(der(0x02, Uint8Array.of(0)), rsaEncryption, der(0x04, key)));
}

async function createAppJwt(appId: string, privateKey: string): Promise<string> {
  const keyData = privateKeyDer(privateKey).buffer as ArrayBuffer;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = base64Url(
    new TextEncoder().encode(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId })),
  );
  const signingInput = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput).buffer as ArrayBuffer,
  );
  return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
}

async function getInstallationToken(repository: string): Promise<string> {
  const appId = process.env.GITHUB_APP_ID?.trim();
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID?.trim();
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.trim();
  if (!appId || !installationId || !privateKey) {
    throw new Error("GitHub App credentials are not configured.");
  }

  if (
    cachedInstallationToken?.repository === repository &&
    cachedInstallationToken.expiresAt > Date.now() + 60_000
  ) {
    return cachedInstallationToken.token;
  }

  const jwt = await createAppJwt(appId, privateKey);
  const [, repo] = repository.split("/");
  const response = await fetch(
    `https://api.github.com/app/installations/${encodeURIComponent(installationId)}/access_tokens`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${jwt}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "Actyl-support-form",
      },
      body: JSON.stringify({
        repositories: [repo],
        permissions: { issues: "write" },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    throw new Error(`GitHub App token request failed (HTTP ${response.status}).`);
  }

  const data = (await response.json()) as { token?: string; expires_at?: string };
  if (!data.token || !data.expires_at) {
    throw new Error("GitHub returned an incomplete installation token response.");
  }
  cachedInstallationToken = {
    repository,
    token: data.token,
    expiresAt: Date.parse(data.expires_at),
  };
  return data.token;
}

/** Creates an issue on the server under the GitHub App's identity. */
export async function createFeedbackIssue(
  report: ReportForIssue,
): Promise<GitHubIssueResult> {
  const repository = process.env.GITHUB_ISSUES_REPOSITORY ?? "tomjanvier/resolvehq-actyl";
  const [owner, repo] = repository.split("/");
  if (!owner || !repo || repository.split("/").length !== 2) {
    return { state: "PENDING", note: "GitHub issue integration is not configured." };
  }

  const body = [
    `Signalement Actyl (référence \`${report.id}\`)`,
    "",
    `**Compte Actyl** : ${report.userName} <${report.userEmail}>`,
    `**Page** : ${report.pagePath ?? "non précisée"}`,
    ...(report.deviceInfo ? ["", "### Appareil et navigateur", report.deviceInfo] : []),
    "",
    "### Problème constaté",
    report.description,
    "",
    "### Résultat attendu",
    report.expected ?? "Non précisé",
    "",
    "### Résultat observé",
    report.observed ?? "Non précisé",
    "",
    "### Étapes pour reproduire",
    report.steps ?? "Non précisées",
    "",
    "---",
    "Rapport transmis depuis le formulaire de support Actyl. L’identité du compte et les informations techniques de l’appareil sont incluses pour faciliter le diagnostic.",
  ].join("\n");

  try {
    const token = await getInstallationToken(repository);
    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
          "User-Agent": "Actyl-support-form",
        },
        body: JSON.stringify({ title: `[Actyl] ${report.title}`.slice(0, 256), body }),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!response.ok) {
      return {
        state: "FAILED",
        note: `GitHub issue creation failed (HTTP ${response.status}).`,
      };
    }

    const issue = (await response.json()) as { number?: number; html_url?: string };
    if (!issue.number || !issue.html_url) {
      return { state: "FAILED", note: "GitHub returned an incomplete issue response." };
    }
    return { state: "CREATED", number: issue.number, url: issue.html_url };
  } catch {
    return { state: "FAILED", note: "GitHub App authentication or API request failed." };
  }
}
