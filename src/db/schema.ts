import {
  pgTable,
  text,
  uuid,
  jsonb,
  integer,
  timestamp,
  primaryKey,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { JSONContent } from "@tiptap/core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  color: text("color").notNull().default("#5b6cff"),
});

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull().default("Untitled document"),
    // TipTap/ProseMirror JSON. Stored structurally (not HTML) so formatting
    // round-trips exactly and can be validated against the editor schema.
    content: jsonb("content").$type<JSONContent>().notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Optimistic-concurrency counter for content saves.
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("documents_owner_idx").on(t.ownerId)],
);

export const documentShares = pgTable(
  "document_shares",
  {
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<"editor" | "viewer">().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.documentId, t.userId] }),
    index("document_shares_user_idx").on(t.userId),
    check("document_shares_role_check", sql`${t.role} in ('editor', 'viewer')`),
  ],
);

export type User = typeof users.$inferSelect;
export type Document = typeof documents.$inferSelect;
