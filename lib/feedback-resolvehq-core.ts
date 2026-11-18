import "server-only";

export type ReportForResolveHQ = {
  id: string;
  category: string;
  title: string;
  description: string;
  expected: string | null;
  observed: string | null;
  steps: string | null;
  pagePath: string | null;
  deviceInfo: string | null;
  userName: string;
  userEmail: string;
};

export type ResolveHQResult =
  | { state: "CREATED"; id: string; url: string }
  | { state: "FAILED"; note: string }
  | { state: "NOT_CONFIGURED"; note: string };

/** Forward an Actyl report into the internal ResolveHQ inbox using a scoped API key. */
export async function createResolveHQTicket(report: ReportForResolveHQ): Promise<ResolveHQResult> {
  const base = process.env.RESOLVEHQ_API_URL?.trim().replace(/\/+$/, "");
  const key = process.env.RESOLVEHQ_API_KEY?.trim();
  const inboxId = process.env.RESOLVEHQ_INBOX_ID?.trim();
  if (!base || !key) return { state: "NOT_CONFIGURED", note: "ResolveHQ is not connected." };

  let apiBase: string;
  try {
    const parsed = new URL(base);
    if (parsed.protocol !== "https:") throw new Error("https required");
    apiBase = `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}/api/v1`;
  } catch {
    return { state: "FAILED", note: "ResolveHQ URL must be a valid HTTPS address." };
  }

  const ref = report.id.slice(-12).toUpperCase();
  const subject = `[Actyl ${ref}] ${report.title}`.slice(0, 240);
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const request = async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`${apiBase}${path}`, {
      ...init,
      headers: { ...headers, ...init.headers },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`ResolveHQ responded ${response.status}`);
    return response.json() as Promise<Record<string, unknown>>;
  };

  try {
    // The marker makes retries safe if ResolveHQ accepted a create before Actyl persisted its id.
    const existing = await request(`/tickets?q=${encodeURIComponent(`[Actyl ${ref}]`)}&limit=50`);
    const matches = (existing.items ?? existing.tickets) as Array<{ id?: string; subject?: string }> | undefined;
    const match = matches?.find((ticket) => ticket.subject?.includes(`[Actyl ${ref}]`));
    if (match?.id) return { state: "CREATED", id: match.id, url: `${base}/inbox/${encodeURIComponent(match.id)}` };

    const customers = await request(`/customers?q=${encodeURIComponent(report.userEmail)}&limit=50`);
    const customerRows = (customers.items ?? customers.customers) as Array<{ id?: string; email?: string }> | undefined;
    let customer = customerRows?.find((item) => item.email?.toLowerCase() === report.userEmail.toLowerCase());
    if (!customer?.id) {
      const created = await request("/customers", {
        method: "POST",
        body: JSON.stringify({ name: report.userName || report.userEmail, email: report.userEmail, company: "Actyl" }),
      });
      customer = created.customer as { id?: string; email?: string };
    }
    if (!customer?.id) throw new Error("ResolveHQ customer was not returned");

    const sections = [
      `Signalement Actyl · ${report.category} · référence ${ref}`,
      `Compte : ${report.userName} <${report.userEmail}>`,
      `Page : ${report.pagePath ?? "non précisée"}`,
      "",
      "Problème décrit :",
      report.description,
      ...(report.expected ? ["", "Résultat attendu :", report.expected] : []),
      ...(report.observed ? ["", "Résultat observé :", report.observed] : []),
      ...(report.steps ? ["", "Étapes pour reproduire :", report.steps] : []),
      ...(report.deviceInfo ? ["", "Informations appareil :", report.deviceInfo] : []),
      "",
      `Source : ${process.env.ACTYL_PUBLIC_URL ?? "Actyl"}/admin/support`,
    ];
    const created = await request("/tickets", {
      method: "POST",
      body: JSON.stringify({
        customerId: customer.id,
        subject,
        message: sections.join("\n"),
        priority: report.category === "BUG" ? "high" : "normal",
        ...(inboxId ? { inboxId } : {}),
      }),
    });
    const ticket = created.ticket as { id?: string } | undefined;
    if (!ticket?.id) throw new Error("ResolveHQ ticket was not returned");
    return { state: "CREATED", id: ticket.id, url: `${base}/inbox/${encodeURIComponent(ticket.id)}` };
  } catch {
    return { state: "FAILED", note: "ResolveHQ could not accept the ticket; retry from Actyl administration." };
  }
}
