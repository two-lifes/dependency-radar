import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

let db: Db | undefined;

/**
 * Lazy so that importing this module (build, unit tests) never needs
 * DATABASE_URL. One client per process: Vercel Fluid compute reuses instances.
 */
export function getDb(): Db {
  if (db) return db;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. See .env.example.");
  }

  // Neon's pooled URL goes through PgBouncer in transaction mode, which has no
  // server-side prepared statements. SSL comes from `sslmode` in the URL.
  const client = postgres(url, { prepare: false });
  db = drizzle({ client, schema });
  return db;
}
