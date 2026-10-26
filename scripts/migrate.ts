// Applies SQL migrations from ./drizzle. Safe to run on every deploy.
import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "../src/db";

async function main() {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
