import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // TypeScript rules
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/ban-ts-comment": "warn",

      // React & Next.js rules
      "react-hooks/exhaustive-deps": "warn",
      "@next/next/no-img-element": "off", // Allowed for dynamic crawl image rendering

      // General JavaScript rules
      "prefer-const": "error",
      "no-debugger": "error",
      "no-unreachable": "error",
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-console": "off", // Allowed for server/crawler logging
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "**/dist/**",
      "next-env.d.ts",
      "*.tsbuildinfo",
    ],
  },
];

export default eslintConfig;
