import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Configuration minimale : l'adaptateur génère `.open-next/worker.js`
  // (référencé par `wrangler.jsonc`) et sert les assets statiques.
  // Cache ISR : comportement Next.js par défaut (purge via revalidatePath
  // des Server Actions, déjà utilisée par l'application).
});
