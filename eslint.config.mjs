import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const restrictedDatabasePaths = [
  {
    name: "drizzle-orm",
    message:
      "UI code must call domain operations and cannot access database clients."
  },
  {
    name: "postgres",
    message:
      "UI code must call domain operations and cannot access database clients."
  }
];

const restrictedDatabasePatterns = [
  {
    group: [
      "@/db",
      "@/db/**",
      "@/lib/db",
      "@/lib/db/**",
      "@/domains/**/repositories/**",
      "@/domains/**/repository/**",
      "@/domains/**/persistence/**",
      "**/db",
      "**/db/**",
      "**/repositories/**",
      "**/repository/**",
      "**/persistence/**"
    ],
    message:
      "UI code must call domain operations and cannot access database clients or domain repositories."
  }
];

export default defineConfig(
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([
    ".next/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**"
  ]),
  {
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: restrictedDatabasePaths,
          patterns: restrictedDatabasePatterns
        }
      ]
    }
  }
);
