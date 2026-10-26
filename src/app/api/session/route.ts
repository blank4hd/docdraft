import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { HttpError, json, readJson, route } from "@/lib/http";
import { sessionCookieHeader, userFromRequest } from "@/lib/session";

const SignIn = z.object({ userId: z.string().min(1, "Pick a user to sign in as.") });

// Mocked sign-in: choose one of the seeded accounts.
export const POST = route(async (req) => {
  const { userId } = SignIn.parse(await readJson(req));
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new HttpError(404, "Unknown user.");
  const res = json({ user });
  res.headers.append("Set-Cookie", sessionCookieHeader(user.id));
  return res;
});

export const GET = route(async (req) => json({ user: await userFromRequest(req) }));

export const DELETE = route(async () => {
  const res = json({ ok: true });
  res.headers.append("Set-Cookie", sessionCookieHeader(null));
  return res;
});
