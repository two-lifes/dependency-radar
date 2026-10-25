import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../../src/server/db/schema";

/** No fallback to the app's DATABASE_URL: integration tests need an explicit disposable database. */
export function testDatabase() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url)
    throw new Error(
      "Set TEST_DATABASE_URL to a disposable PostgreSQL database",
    );
  const client = postgres(url, { prepare: false });
  return { client, db: drizzle({ client, schema }) };
}
