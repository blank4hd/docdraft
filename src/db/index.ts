import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  }
  // Small pool: serverless functions each hold their own pool.
  return new Pool({ connectionString, max: 5 });
}

// Reuse the pool across hot reloads in dev and across invocations of a warm lambda.
const globalForDb = globalThis as unknown as { __pool?: Pool };
const pool = globalForDb.__pool ?? createPool();
globalForDb.__pool = pool;

export const db = drizzle(pool, { schema });
export { pool };
