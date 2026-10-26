import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { User } from "@/db/schema";
import { userFromRequest } from "./session";
import { InvalidContentError } from "./content";
import { UnsupportedFileError } from "./convert";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

export async function requireUser(req: Request): Promise<User> {
  const user = await userFromRequest(req);
  if (!user) throw new HttpError(401, "Not signed in.");
  return user;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function assertUuid(id: string) {
  // Unknown and malformed ids both look like "not found" to the caller.
  if (!UUID_RE.test(id)) throw new HttpError(404, "Document not found.");
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wraps a route handler with consistent JSON error responses. */
export function route<C>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message, ...err.extra }, err.status);
      if (err instanceof ZodError) {
        return json({ error: err.issues[0]?.message ?? "Invalid request." }, 400);
      }
      if (err instanceof InvalidContentError) return json({ error: err.message }, 400);
      if (err instanceof UnsupportedFileError) return json({ error: err.message }, 415);
      console.error(err);
      return json({ error: "Something went wrong. Please try again." }, 500);
    }
  };
}
