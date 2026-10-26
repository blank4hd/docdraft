import { asc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { json, requireUser, route } from "@/lib/http";

// Directory of people you can share with (internal tool: everyone can see everyone).
export const GET = route(async (req) => {
  await requireUser(req);
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, color: users.color })
    .from(users)
    .orderBy(asc(users.name));
  return json({ users: rows });
});
