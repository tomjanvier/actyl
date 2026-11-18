import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { createResolveHQTicket } from "../lib/feedback-resolvehq-core";
import { feedbackRetryDelayMs } from "../lib/feedback-retry-policy";
import {
  expectedTurnstileHostname,
  isValidTurnstileResult,
} from "../lib/turnstile-validation";

test("Turnstile hostname uses the configured HTTPS app origin", () => {
  assert.equal(
    expectedTurnstileHostname({ appUrl: "https://Actyl.org/a/path", host: "preview.example.test" }),
    "actyl.org",
  );
  assert.equal(
    expectedTurnstileHostname({ forwardedHost: "preview.example.test, proxy.internal" }),
    "preview.example.test",
  );
  assert.equal(expectedTurnstileHostname({ appUrl: "http://actyl.org", host: "actyl.org" }), null);
});

test("Turnstile validation requires success, action, and hostname", () => {
  const valid = { success: true, action: "petition-signature", hostname: "actyl.org" };
  assert.equal(isValidTurnstileResult(valid, "petition-signature", "actyl.org"), true);
  assert.equal(isValidTurnstileResult({ ...valid, action: "signup" }, "petition-signature", "actyl.org"), false);
  assert.equal(isValidTurnstileResult({ ...valid, hostname: "attacker.test" }, "petition-signature", "actyl.org"), false);
  assert.equal(isValidTurnstileResult({ ...valid, success: false }, "petition-signature", "actyl.org"), false);
});

test("ResolveHQ retry delays increase and cap at one day", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5].map(feedbackRetryDelayMs),
    [15 * 60_000, 60 * 60_000, 6 * 60 * 60_000, 24 * 60 * 60_000, 24 * 60 * 60_000],
  );
});

function mockResolveHQ(
  t: TestContext,
  handler: (url: URL, init?: RequestInit) => Response | Promise<Response>,
  options: { inboxId?: string } = {},
) {
  const previousFetch = globalThis.fetch;
  const previousUrl = process.env.RESOLVEHQ_API_URL;
  const previousKey = process.env.RESOLVEHQ_API_KEY;
  const previousInboxId = process.env.RESOLVEHQ_INBOX_ID;
  process.env.RESOLVEHQ_API_URL = "https://resolvehq.example.test";
  process.env.RESOLVEHQ_API_KEY = "test-only-placeholder";
  if (options.inboxId) process.env.RESOLVEHQ_INBOX_ID = options.inboxId;
  else delete process.env.RESOLVEHQ_INBOX_ID;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof URL ? input : new URL(typeof input === "string" ? input : input.url);
    return handler(url, init);
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.RESOLVEHQ_API_URL;
    else process.env.RESOLVEHQ_API_URL = previousUrl;
    if (previousKey === undefined) delete process.env.RESOLVEHQ_API_KEY;
    else process.env.RESOLVEHQ_API_KEY = previousKey;
    if (previousInboxId === undefined) delete process.env.RESOLVEHQ_INBOX_ID;
    else process.env.RESOLVEHQ_INBOX_ID = previousInboxId;
  });
}

const report = {
  id: "report-345678901234",
  category: "BUG",
  title: "Titre du signalement",
  description: "Description de test suffisamment longue.",
  expected: null,
  observed: null,
  steps: null,
  pagePath: "/campaigns/test",
  deviceInfo: null,
  userName: "Ada",
  userEmail: "ada@example.test",
};

test("ResolveHQ returns a matching existing ticket without creating another", async (t) => {
  let postCount = 0;
  mockResolveHQ(t, (url, init) => {
    if (url.pathname.endsWith("/tickets") && !init?.method) {
      return Response.json({ items: [{ id: "tkt_existing", subject: "[Actyl 345678901234] Existing" }] });
    }
    if (init?.method === "POST") postCount += 1;
    throw new Error(`Unexpected mocked request: ${url.pathname}`);
  });

  const result = await createResolveHQTicket(report);
  assert.deepEqual(result, {
    state: "CREATED",
    id: "tkt_existing",
    url: "https://resolvehq.example.test/inbox/tkt_existing",
  });
  assert.equal(postCount, 0);
});

test("ResolveHQ retry recovers accepted ticket after an uncertain create response", async (t) => {
  const tickets: Array<{ id: string; subject: string }> = [];
  let ticketPostCount = 0;
  mockResolveHQ(t, (url, init) => {
    if (url.pathname.endsWith("/tickets") && !init?.method) return Response.json({ items: tickets });
    if (url.pathname.endsWith("/customers")) {
      return Response.json({ items: [{ id: "cus_existing", email: "ada@example.test" }] });
    }
    if (url.pathname.endsWith("/tickets") && init?.method === "POST") {
      ticketPostCount += 1;
      const body = JSON.parse(String(init.body)) as { subject: string; inboxId?: string };
      assert.equal(body.inboxId, "inbox_test_placeholder");
      tickets.push({ id: "tkt_accepted", subject: body.subject });
      return Response.json({ error: "response lost after acceptance" }, { status: 503 });
    }
    throw new Error(`Unexpected mocked request: ${url.pathname}`);
  }, { inboxId: "inbox_test_placeholder" });

  const firstAttempt = await createResolveHQTicket(report);
  const retry = await createResolveHQTicket(report);

  assert.equal(firstAttempt.state, "FAILED");
  assert.deepEqual(retry, {
    state: "CREATED",
    id: "tkt_accepted",
    url: "https://resolvehq.example.test/inbox/tkt_accepted",
  });
  assert.equal(ticketPostCount, 1);
});

test("ResolveHQ omits inboxId when no inbox is configured", async (t) => {
  let ticketPayload: Record<string, unknown> | undefined;
  mockResolveHQ(t, (url, init) => {
    if (url.pathname.endsWith("/tickets") && !init?.method) return Response.json({ items: [] });
    if (url.pathname.endsWith("/customers")) {
      return Response.json({ items: [{ id: "cus_existing", email: "ada@example.test" }] });
    }
    if (url.pathname.endsWith("/tickets") && init?.method === "POST") {
      ticketPayload = JSON.parse(String(init.body)) as Record<string, unknown>;
      return Response.json({ ticket: { id: "tkt_default_inbox" } });
    }
    throw new Error(`Unexpected mocked request: ${url.pathname}`);
  });

  const result = await createResolveHQTicket(report);
  assert.equal(result.state, "CREATED");
  assert.equal(Object.hasOwn(ticketPayload ?? {}, "inboxId"), false);
});
