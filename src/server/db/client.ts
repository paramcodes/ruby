import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

type Database = ReturnType<typeof drizzle>;

let client: Database | undefined;

function connect(): Database {
  if (!client) {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL is not set. Configure it (see .env.example) before using the database client."
      );
    }

    client = drizzle(postgres(databaseUrl));
  }

  return client;
}

export const db = new Proxy({} as Database, {
  get(_target, property) {
    const database = connect();
    const value = Reflect.get(database, property);

    return typeof value === "function" ? value.bind(database) : value;
  }
});
