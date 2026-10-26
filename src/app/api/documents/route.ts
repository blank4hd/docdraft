import { z } from "zod";
import { json, readJson, requireUser, route } from "@/lib/http";
import { createDocument, listDocumentsForUser } from "@/lib/documents";
import { EMPTY_DOC } from "@/lib/content";

const Create = z.object({
  title: z.string().trim().min(1).max(200).optional(),
});

export const GET = route(async (req) => {
  const user = await requireUser(req);
  return json(await listDocumentsForUser(user.id));
});

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const body = Create.parse(await readJson(req).catch(() => ({})));
  const doc = await createDocument(user.id, body.title ?? "Untitled document", EMPTY_DOC);
  return json({ document: doc }, 201);
});
