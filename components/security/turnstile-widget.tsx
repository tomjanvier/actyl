"use client";

import Script from "next/script";
import type { TurnstileAction } from "@/lib/turnstile-validation";

export function TurnstileWidget({ action }: { action: TurnstileAction }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      <div className="cf-turnstile" data-sitekey={siteKey} data-action={action} data-theme="auto" data-language="fr" data-appearance="interaction-only" data-size="flexible" />
    </>
  );
}
