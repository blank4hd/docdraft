// Data access for documents and shares. Every read that returns a document
// also returns the caller's role, so callers can't forget the access check.
import { and, desc, eq, sql } from "drizzle-orm";
import type { JSONContent } from "@tiptap/core";
import { db } from "@/db";
import { documents, documentShares, users } from "@/db/schema";
import { permissionsFor, resolveRole, type Role, type ShareRole } from "./access";
import { previewText } from "./content";

export interface DocSummary {
  id: string;
  title: string;
  updatedAt: Date;
  preview: string;
  role: Role;
  owner: { id: string; name: string };
  shareCount: number;
}

export async function listDocumentsForUser(userId: string) {
  const owned = await db
    .select({
      doc: documents,
      ownerName: users.name,
      shareCount: sql<number>`(select count(*)::int from ${documentShares} where ${documentShares.documentId} = ${documents.id})`,
    })
    .from(documents)
    .innerJoin(users, eq(users.id, documents.ownerId))
    .where(eq(documents.ownerId, userId))
    .orderBy(desc(documents.updatedAt));

  const shared = await db
    .select({ doc: documents, ownerName: users.name, role: documentShares.role })
    .from(documentShares)
    .innerJoin(documents, eq(documents.id, documentShares.documentId))
    .innerJoin(users, eq(users.id, documents.ownerId))
    .where(eq(documentShares.userId, userId))
    .orderBy(desc(documents.updatedAt));

  const toSummary = (
    doc: typeof documents.$inferSelect,
    ownerName: string,
    role: Role,
    shareCount = 0,
  ): DocSummary => ({
    id: doc.id,
    title: doc.title,
    updatedAt: doc.updatedAt,
    preview: previewText(doc.content),
    role,
    owner: { id: doc.ownerId, name: ownerName },
    shareCount,
  });

  return {
    owned: owned.map((r) => toSummary(r.doc, r.ownerName, "owner", r.shareCount)),
    shared: shared.map((r) => toSummary(r.doc, r.ownerName, r.role)),
  };
}

/** Returns the document plus the caller's role, or null if they have no access. */
export async function getDocumentForUser(docId: string, userId: string) {
  const [row] = await db
    .select({ doc: documents, ownerName: users.name, shareRole: documentShares.role })
    .from(documents)
    .innerJoin(users, eq(users.id, documents.ownerId))
    .leftJoin(
      documentShares,
      and(eq(documentShares.documentId, documents.id), eq(documentShares.userId, userId)),
    )
    .where(eq(documents.id, docId))
    .limit(1);
  if (!row) return null;
  const role = resolveRole(row.doc, userId, row.shareRole);
  if (!role) return null; // treat "exists but not yours" as not found: no existence leak
  return {
    ...row.doc,
    owner: { id: row.doc.ownerId, name: row.ownerName },
    role,
    permissions: permissionsFor(role),
  };
}

export async function createDocument(ownerId: string, title: string, content: JSONContent) {
  const [doc] = await db.insert(documents).values({ ownerId, title, content }).returning();
  return doc;
}

export async function renameDocument(docId: string, title: string) {
  const [doc] = await db
    .update(documents)
    .set({ title, updatedAt: new Date() })
    .where(eq(documents.id, docId))
    .returning({ title: documents.title, updatedAt: documents.updatedAt, version: documents.version });
  return doc;
}

/**
 * Optimistic concurrency: the write only lands if the client edited the
 * latest version. Returns null on conflict so the caller can respond 409.
 */
export async function saveContent(docId: string, content: JSONContent, baseVersion: number) {
  const [doc] = await db
    .update(documents)
    .set({ content, version: sql`${documents.version} + 1`, updatedAt: new Date() })
    .where(and(eq(documents.id, docId), eq(documents.version, baseVersion)))
    .returning({ version: documents.version, updatedAt: documents.updatedAt });
  return doc ?? null;
}

export async function deleteDocument(docId: string) {
  await db.delete(documents).where(eq(documents.id, docId));
}

export async function listShares(docId: string) {
  return db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      color: users.color,
      role: documentShares.role,
    })
    .from(documentShares)
    .innerJoin(users, eq(users.id, documentShares.userId))
    .where(eq(documentShares.documentId, docId))
    .orderBy(users.name);
}

export async function findUserByEmail(email: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email.trim().toLowerCase()}`)
    .limit(1);
  return user ?? null;
}

export async function upsertShare(docId: string, userId: string, role: ShareRole) {
  await db
    .insert(documentShares)
    .values({ documentId: docId, userId, role })
    .onConflictDoUpdate({
      target: [documentShares.documentId, documentShares.userId],
      set: { role },
    });
}

export async function removeShare(docId: string, userId: string) {
  const res = await db
    .delete(documentShares)
    .where(and(eq(documentShares.documentId, docId), eq(documentShares.userId, userId)))
    .returning({ userId: documentShares.userId });
  return res.length > 0;
}
