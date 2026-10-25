import { migrate } from "drizzle-orm/postgres-js/migrator";
import { testDatabase } from "./database";

export default async function setup() {
  const { client, db } = testDatabase();
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
  } finally {
    await client.end();
  }
}
