import { HttpError, assertUuid, json, requireUser, route } from "@/lib/http";
import { getDocumentForUser, listShares, removeShare } from "@/lib/documents";

type Ctx = { params: Promise<{ id: string; userId: string }> };

// Owner revokes someone's access; a collaborator may also remove themselves.
export const DELETE = route(async (req, ctx: Ctx) => {
  const user = await requireUser(req);
  const { id, userId } = await ctx.params;
  assertUuid(id);
  const doc = await getDocumentForUser(id, user.id);
  if (!doc) throw new HttpError(404, "Document not found.");
  if (!doc.permissions.canShare && userId !== user.id) {
    throw new HttpError(403, "Only the owner can remove collaborators.");
  }
  const removed = await removeShare(doc.id, userId);
  if (!removed) throw new HttpError(404, "That user doesn't have access.");
  return json({ shares: await listShares(doc.id) });
});
