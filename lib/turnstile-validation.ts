export const TURNSTILE_ACTIONS = [
  "signup",
  "petition-signature",
  "citizen-email",
] as const;

export type TurnstileAction = (typeof TURNSTILE_ACTIONS)[number];

export type TurnstileSiteverifyResult = {
  success?: boolean;
  action?: string;
  hostname?: string;
};

function parseHostname(value: string | null | undefined): string | null {
  const host = value?.split(",", 1)[0]?.trim();
  if (!host || host.length > 255) return null;

  try {
    const parsed = new URL(`https://${host}`);
    if (parsed.username || parsed.password || parsed.pathname !== "/") return null;
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Resolve the expected hostname from the configured app origin or request host. */
export function expectedTurnstileHostname(input: {
  appUrl?: string;
  host?: string | null;
  forwardedHost?: string | null;
}): string | null {
  if (input.appUrl?.trim()) {
    try {
      const appUrl = new URL(input.appUrl.trim());
      if (appUrl.protocol !== "https:") return null;
      return appUrl.hostname.toLowerCase();
    } catch {
      return null;
    }
  }

  return parseHostname(input.host) ?? parseHostname(input.forwardedHost);
}

export function isValidTurnstileResult(
  result: TurnstileSiteverifyResult,
  expectedAction: TurnstileAction,
  expectedHostname: string,
): boolean {
  return (
    result.success === true &&
    result.action === expectedAction &&
    result.hostname?.toLowerCase() === expectedHostname.toLowerCase()
  );
}
