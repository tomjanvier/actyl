// OpenNext generates only a fetch handler; this wrapper also dispatches cron work.
import handler from "./.open-next/worker.js";

const FEEDBACK_RETRY_CRON = "*/15 * * * *";
const REFERENCE_SYNC_CRON = "0 4 * * 1";

const worker = {
  fetch: handler.fetch,

  async scheduled(event, env, ctx) {
    const path = event.cron === FEEDBACK_RETRY_CRON
      ? "/api/cron/feedback-resolvehq"
      : event.cron === REFERENCE_SYNC_CRON
        ? "/api/cron/reference-packs"
        : null;
    if (!path) return;

    const secret = env.CRON_SECRET;
    if (!secret) throw new Error("CRON_SECRET is required for scheduled Actyl jobs");

    const response = await handler.fetch(
      new Request(`https://actyl.org${path}`, { headers: { authorization: `Bearer ${secret}` } }),
      env,
      ctx,
    );
    if (!response.ok) throw new Error(`Scheduled Actyl job failed with ${response.status}`);
  },
};

export default worker;
export { DOQueueHandler, DOShardedTagCache } from "./.open-next/worker.js";
