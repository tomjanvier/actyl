import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Next 16 : les nouvelles règles « React Compiler » d'eslint-plugin-react-hooks v6
    // signalent 23 erreurs dans du code préexistant (daté de la migration, pas de régressions).
    // Désactivées le temps de migrer le code ; TODO: réactiver et corriger les fichiers listés
    // dans le run CI 42312612817 (purity, set-state-in-effect, error-boundaries, immutability).
    rules: {
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/error-boundaries": "off",
      "react-hooks/immutability": "off",
      "@next/next/no-location-assign-relative-destination": "off",
    },
  },
  {
    ignores: [
      ".next/**",
      ".open-next/**",
      ".wrangler/**",
      "node_modules/**",
      "next-env.d.ts",
      "cloudflare-env.d.ts",
      "prisma/*.db",
      "generated/**",
    ],
  },
];

export default eslintConfig;
