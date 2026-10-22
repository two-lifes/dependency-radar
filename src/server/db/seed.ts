import { existsSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { seedDemo } from "./demo";
import * as schema from "./schema";

// `pnpm db:seed`. Locally the URL comes from .env.local, like drizzle.config.ts.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set. See .env.example.");
}

async function main(databaseUrl: string) {
  // Own client instead of getDb(): the script has to close it to exit.
  const client = postgres(databaseUrl, { prepare: false, max: 1 });
  try {
    await seedDemo(drizzle({ client, schema }));
    console.log("Demo account seeded.");
  } finally {
    await client.end();
  }
}

// The package is CommonJS, where tsx allows no top-level await.
main(url).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
