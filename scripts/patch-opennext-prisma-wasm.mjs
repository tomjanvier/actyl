/**
 * Post-traitement OpenNext : rend le compilateur de requêtes Prisma
 * importable comme module WebAssembly statique.
 *
 * Contexte : le client Prisma 7 (Rust-free) compile les requêtes via un
 * module WASM. Le chargeur généré décode du base64 embarqué puis appelle
 * `new WebAssembly.Module(bytes)` AU RUNTIME — interdit par l'embedder
 * workerd (« Wasm code generation disallowed by embedder », vérifié en
 * local). En revanche, workerd accepte les modules WASM importés
 * STATIQUEMENT (compilés par esbuild/wrangler au déploiement).
 *
 * Ce script, exécuté après `opennextjs-cloudflare build` (voir `build:cf`) :
 * 1. extrait les bytes WASM depuis
 *    `@prisma/client/runtime/query_compiler_fast_bg.postgresql.wasm-base64.mjs`
 *    vers `prisma-query-compiler.wasm` à côté de chaque `handler.mjs` ;
 * 2. remplace le chargeur base64→runtime par `return <module statique>`.
 *
 * Garde-fous :
 * - le script ÉCHOUE bruyamment si l'ancre du chargeur n'est pas trouvée
 *   (mise à jour Prisma/OpenNext → revalidation obligatoire, jamais de
 *   régression silencieuse) ;
 * - idempotent (ne re-patche pas un bundle déjà patché) ;
 * - la validation se fait via `wrangler dev` + route dépendant de la base :
 *   une erreur de CONNEXION (et non `CompileError`) prouve le mécanisme.
 *
 * Taille : ~3,4 Mo bruts (~1,1 Mo gzip) → plan Workers Paid requis
 * (limite 10 Mo ; le plan gratuit est plafonné à 3 Mo).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_FUNCTIONS = join(ROOT, ".open-next", "server-functions");
const WASM_B64_MODULE =
  "@prisma/client/runtime/query_compiler_fast_bg.postgresql.wasm-base64.mjs";
const WASM_FILENAME = "prisma-query-compiler.wasm";
const IMPORT_NAME = "__PRISMA_COMPILER_WASM__";

// Ancre stable à travers les builds : le chargeur généré par Prisma.
// Plusieurs occurrences possibles (variantes du compilateur) : toutes patchées.
// Le flag `g` est essentiel : `String.replace` sans `g` ne remplace que la
// première occurrence et laisse un chargeur runtime actif (vérifié le 14/09).
const LOADER_RE =
  /getQueryCompilerWasmModule:async\(\)=>\{let\{wasm:\w+\}=await Promise\.resolve\(\)\.then\(\w+\.bind\(\w+,\d+\)\);return await \w+\(\w+\)\}/g;

function extractWasmBytes() {
  // node_modules racine (symlink pnpm) + résolution ESM standard.
  const tried = [];
  const direct = join(ROOT, "node_modules", ...WASM_B64_MODULE.split("/"));
  tried.push(direct);
  let viaResolve = null;
  try {
    viaResolve = fileURLToPath(import.meta.resolve(WASM_B64_MODULE));
    tried.push(viaResolve);
  } catch {}
  for (const p of tried) {
    if (p && existsSync(p)) {
      const src = readFileSync(p, "utf8");
      const m = src.match(/"([A-Za-z0-9+/=]{100000,})"/);
      if (!m) throw new Error(`Base64 WASM introuvable dans ${p}`);
      return Buffer.from(m[1], "base64");
    }
  }
  throw new Error(
    `Module ${WASM_B64_MODULE} introuvable (chemins essayés : ${tried.join(", ")}).`
  );
}

function findHandlers(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findHandlers(p));
    else if (entry.isFile() && entry.name === "handler.mjs") out.push(p);
  }
  return out;
}

function main() {
  const handlers = findHandlers(SERVER_FUNCTIONS);
  if (handlers.length === 0) {
    throw new Error(
      `Aucun handler.mjs trouvé sous ${SERVER_FUNCTIONS} — lancez d'abord opennextjs-cloudflare build.`
    );
  }
  const wasmBytes = extractWasmBytes();
  console.log(`[prisma-wasm] ${wasmBytes.length} octets de compilateur extraits.`);
  for (const handler of handlers) {
    const dir = dirname(handler);
    writeFileSync(join(dir, WASM_FILENAME), wasmBytes);
    let src = readFileSync(handler, "utf8");
    const matches = src.match(LOADER_RE) ?? [];
    if (matches.length === 0) {
      if (src.includes(IMPORT_NAME)) {
        console.log(`[prisma-wasm] ${handler} déjà patché, ignoré.`);
        continue;
      }
      throw new Error(
        `[prisma-wasm] Ancre du chargeur Prisma introuvable dans ${handler}.\n` +
          `La version Prisma/OpenNext a probablement changé : revalidation manuelle requise ` +
          `(voir scripts/patch-opennext-prisma-wasm.mjs).`
      );
    }
    src = src.replace(
      LOADER_RE,
      `getQueryCompilerWasmModule:async()=>${IMPORT_NAME}`
    );
    if (!src.includes(`import ${IMPORT_NAME} `)) {
      src = `import ${IMPORT_NAME} from "./${WASM_FILENAME}";\n${src}`;
    }
    writeFileSync(handler, src);
    console.log(`[prisma-wasm] ${handler} patché (${matches.length} chargeur(s)).`);
  }
}

main();
