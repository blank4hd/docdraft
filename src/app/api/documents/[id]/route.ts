import { z } from "zod";
import { HttpError, assertUuid, json, readJson, requireUser, route } from "@/lib/http";
import {
  deleteDocument,
  getDocumentForUser,
  renameDocument,
  saveContent,
} from "@/lib/documents";
import { validateContent } from "@/lib/content";

type Ctx = { params: Promise<{ id: string }> };

const Patch = z
  .object({
    title: z.string().trim().min(1, "Title can't be empty.").max(200, "Title is too long.").optional(),
    content: z.unknown().optional(),
    version: z.number().int().positive().optional(),
  })
  .refine((b) => b.title !== undefined || b.content !== undefined, "Nothing to update.")
  .refine((b) => b.content === undefined || b.version !== undefined, "version is required when saving content.");

async function load(req: Request, ctx: Ctx) {
  const user = await requireUser(req);
  const { id } = await ctx.params;
  assertUuid(id);
  const doc = await getDocumentForUser(id, user.id);
  if (!doc) throw new HttpError(404, "Document not found.");
  return doc;
}

export const GET = route(async (req, ctx: Ctx) => json({ document: await load(req, ctx) }));

export const PATCH = route(async (req, ctx: Ctx) => {
  const doc = await load(req, ctx);
  if (!doc.permissions.canEdit) throw new HttpError(403, "You have view-only access to this document.");
  const body = Patch.parse(await readJson(req));

  let result: { title?: string; version: number; updatedAt: Date } = {
    version: doc.version,
    updatedAt: doc.updatedAt,
  };
  if (body.title !== undefined) {
    const r = await renameDocument(doc.id, body.title);
    result = { ...result, ...r };
  }
  if (body.content !== undefined) {
    const content = validateContent(body.content);
    const saved = await saveContent(doc.id, content, body.version!);
    if (!saved) {
      throw new HttpError(409, "This document was changed by someone else since you opened it.");
    }
    result = { ...result, ...saved };
  }
  return json(result);
});

export const DELETE = route(async (req, ctx: Ctx) => {
  const doc = await load(req, ctx);
  if (!doc.permissions.canDelete) throw new HttpError(403, "Only the owner can delete this document.");
  await deleteDocument(doc.id);
  return json({ ok: true });
});
