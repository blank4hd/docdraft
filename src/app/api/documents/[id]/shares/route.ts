import { z } from "zod";
import { HttpError, assertUuid, json, readJson, requireUser, route } from "@/lib/http";
import { findUserByEmail, getDocumentForUser, listShares, upsertShare } from "@/lib/documents";

type Ctx = { params: Promise<{ id: string }> };

const AddShare = z.object({
  email: z.email("Enter a valid email address."),
  role: z.enum(["editor", "viewer"]).default("editor"),
});

async function loadDoc(req: Request, ctx: Ctx) {
  const user = await requireUser(req);
  const { id } = await ctx.params;
  assertUuid(id);
  const doc = await getDocumentForUser(id, user.id);
  if (!doc) throw new HttpError(404, "Document not found.");
  return doc;
}

// Anyone with access can see who else has access.
export const GET = route(async (req, ctx: Ctx) => {
  const doc = await loadDoc(req, ctx);
  return json({ owner: doc.owner, shares: await listShares(doc.id) });
});

// Owner grants (or changes) access by email.
export const POST = route(async (req, ctx: Ctx) => {
  const doc = await loadDoc(req, ctx);
  if (!doc.permissions.canShare) throw new HttpError(403, "Only the owner can share this document.");
  const { email, role } = AddShare.parse(await readJson(req));
  const target = await findUserByEmail(email);
  if (!target) throw new HttpError(404, `No user with email ${email}.`);
  if (target.id === doc.ownerId) throw new HttpError(400, "You already own this document.");
  await upsertShare(doc.id, target.id, role);
  return json({ shares: await listShares(doc.id) }, 201);
});
