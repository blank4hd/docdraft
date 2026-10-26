// Idempotent seed: creates demo users and two demo documents.
// Uses ON CONFLICT DO NOTHING so re-running on every deploy never clobbers
// edits reviewers have made.
import "dotenv/config";
import { db, pool } from "../src/db";
import { users, documents, documentShares } from "../src/db/schema";
import type { JSONContent } from "@tiptap/core";
import { sql } from "drizzle-orm";

export const SEED_USERS = [
  {
    id: "u_alice",
    name: "Alice Chen",
    email: "alice@docdraft.test",
    color: "#5b6cff",
  },
  {
    id: "u_bob",
    name: "Bob Martinez",
    email: "bob@docdraft.test",
    color: "#16a34a",
  },
  {
    id: "u_carol",
    name: "Carol Singh",
    email: "carol@docdraft.test",
    color: "#db2777",
  },
];

const p = (text: string, marks?: JSONContent["marks"]): JSONContent => ({
  type: "paragraph",
  content: [{ type: "text", text, ...(marks ? { marks } : {}) }],
});
const h = (level: number, text: string): JSONContent => ({
  type: "heading",
  attrs: { level },
  content: [{ type: "text", text }],
});
const list = (
  type: "bulletList" | "orderedList",
  items: string[],
): JSONContent => ({
  type,
  content: items.map((t) => ({ type: "listItem", content: [p(t)] })),
});

const welcome: JSONContent = {
  type: "doc",
  content: [
    h(1, "Q4 Planning Notes"),
    {
      type: "paragraph",
      content: [
        { type: "text", text: "This document is owned by " },
        { type: "text", text: "Alice", marks: [{ type: "bold" }] },
        { type: "text", text: " and shared with Bob as an " },
        { type: "text", text: "editor", marks: [{ type: "italic" }] },
        { type: "text", text: ". Carol has " },
        { type: "text", text: "no access", marks: [{ type: "underline" }] },
        { type: "text", text: "." },
      ],
    },
    h(2, "Priorities"),
    list("orderedList", [
      "Ship the editor MVP",
      "Pilot with two internal teams",
      "Collect feedback",
    ]),
    h(2, "Open questions"),
    list("bulletList", [
      "Do we need comments before real-time?",
      "Which import formats matter most?",
    ]),
  ],
};

const bobsDoc: JSONContent = {
  type: "doc",
  content: [
    h(1, "Team Retro"),
    p("Owned by Bob, shared with Alice as a viewer (read-only)."),
    h(3, "What went well"),
    list("bulletList", ["Faster reviews", "Clear owners per project"]),
  ],
};

export const SEED_DOCS = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    title: "Q4 Planning Notes",
    ownerId: "u_alice",
    content: welcome,
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    title: "Team Retro",
    ownerId: "u_bob",
    content: bobsDoc,
  },
];

async function main() {
  // await db.insert(users).values(SEED_USERS).onConflictDoNothing();

  // Upsert demo users so changes to their names/emails reach existing databases.
  // Documents stay "do nothing" so reviewers' edits are never overwritten.
  await db
    .insert(users)
    .values(SEED_USERS)
    .onConflictDoUpdate({
      target: users.id,
      set: {
        name: sql`excluded.name`,
        email: sql`excluded.email`,
        color: sql`excluded.color`,
      },
    });

  await db.insert(documents).values(SEED_DOCS).onConflictDoNothing();
  await db
    .insert(documentShares)
    .values([
      { documentId: SEED_DOCS[0].id, userId: "u_bob", role: "editor" },
      { documentId: SEED_DOCS[1].id, userId: "u_alice", role: "viewer" },
    ])
    .onConflictDoNothing();
  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
