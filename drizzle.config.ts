import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. See .env.example for the documented local default."
  );
}

export default defineConfig({
  schema: [
    "./src/server/db/schema.ts",
    "./src/server/workspaces/schema.ts",
    "./src/server/pages/schema.ts",
    "./src/server/pages/content-schema.ts"
  ],
  out: "./src/server/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl
  }
});
