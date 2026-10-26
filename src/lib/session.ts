// Mocked authentication: the user picks a seeded account and we store their id
// in an HMAC-signed, httpOnly cookie. Swapping in real auth (OAuth, magic link)
// only changes how the cookie gets issued; everything downstream reads userId.
import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type User } from "@/db/schema";

export const SESSION_COOKIE = "docdraft_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set (16+ chars) in production.");
  }
  return "insecure-dev-only-secret";
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function encodeSession(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

export function decodeSession(token: string | undefined | null): string | null {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const userId = token.slice(0, i);
  const given = Buffer.from(token.slice(i + 1));
  const expected = Buffer.from(sign(userId));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return userId;
}

export function sessionCookieHeader(userId: string | null): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  if (!userId) return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
  return `${SESSION_COOKIE}=${encodeSession(userId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}${secure}`;
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export async function userFromToken(token: string | null | undefined): Promise<User | null> {
  const userId = decodeSession(token);
  if (!userId) return null;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user ?? null;
}

/** For API route handlers: reads the cookie straight off the Request. */
export function userFromRequest(req: Request): Promise<User | null> {
  return userFromToken(readCookie(req.headers.get("cookie"), SESSION_COOKIE));
}
