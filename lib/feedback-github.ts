import "server-only";

type ReportForIssue = {
  id: string;
  title: string;
  description: string;
  expected: string | null;
  observed: string | null;
  steps: string | null;
  pagePath: string | null;
};

export type GitHubIssueResult =
  | { state: "CREATED"; number: number; url: string }
  | { state: "PENDING" | "FAILED"; note: string };

/** Creates an issue only from the server, using a fine-grained GitHub token. */
export async function createFeedbackIssue(
  report: ReportForIssue,
): Promise<GitHubIssueResult> {
  const token = process.env.GITHUB_ISSUES_TOKEN;
  const repository = process.env.GITHUB_ISSUES_REPOSITORY ?? "tomjanvier/resolvehq-actyl";
  const [owner, repo] = repository.split("/");
  if (!token || !owner || !repo || repository.split("/").length !== 2) {
    return { state: "PENDING", note: "GitHub issue integration is not configured." };
  }

  const body = [
    `Signalement Actyl (référence \`${report.id}\`)`,
    "",
    `**Page** : ${report.pagePath ?? "non précisée"}`,
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
    "Rapport transmis depuis le formulaire de support Actyl. Aucune adresse e-mail ni donnée de contact n'est incluse.",
  ].join("\n");

  try {
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
    return { state: "FAILED", note: "GitHub could not be reached." };
  }
}
