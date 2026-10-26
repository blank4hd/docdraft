# Architecture note

## What I prioritized and why

The brief rewards depth in a few areas over breadth. I picked the two places where a weak implementation would make the product untrustworthy and put most of the effort there:

1. **Access control that actually holds.** Sharing is only meaningful if the server enforces it. Every route checks permissions; the UI just reflects them.
2. **Editing that never silently loses work.** Autosave, retry, and conflict detection matter more to a real user than extra formatting buttons.

Everything else (formatting set, upload formats, UI polish) is solid but deliberately standard.

## Shape of the system

```
Browser (React + TipTap)
   │  JSON over fetch, session cookie
   ▼
Next.js route handlers  ──  lib/access.ts   (who can do what: pure functions)
   │                        lib/content.ts  (validate doc JSON against editor schema)
   │                        lib/convert.ts  (.txt/.md/.docx → editor JSON)
   ▼
lib/documents.ts (Drizzle) ──► PostgreSQL: users, documents, document_shares
```

One Next.js app holds both frontend and API, so there's one repo, one deploy, and one set of types shared end to end.

## Key decisions

| Decision | Why | Tradeoff |
|---|---|---|
| **Store documents as TipTap/ProseMirror JSON**, not HTML | Formatting round-trips exactly. The server can validate content against the same schema the editor uses, so the DB can never hold markup the editor can't render, and there's no raw HTML to sanitize on read (no stored XSS). | Not human-readable in the DB; export to other formats would need a converter. |
| **One editor schema shared by client and server** (`lib/editor/extensions.ts`) | Upload conversion parses HTML *through the editor schema*, which drops scripts, images, styles, etc. One definition means validation, import and rendering can't drift apart. | Adding a formatting feature means touching one file. That's a plus. |
| **Roles: owner / editor / viewer** in a `document_shares` table | Covers the brief's minimum (owner + grant access) and the stretch (role-based). The permission matrix lives in one pure module that's exhaustively unit-tested. | No groups, link sharing, or transfer of ownership. |
| **Return 404, not 403, to users with no access** | Doesn't reveal that a document exists. Users who *do* have access but lack the permission (e.g. a viewer trying to edit) get 403 with a clear message. | Slightly less helpful error for a mistyped link. |
| **Optimistic concurrency** (`version` column, `UPDATE … WHERE version = $client`) instead of real-time sync | Prevents the worst failure (silent overwrite of a collaborator's work) for about 20 lines of code. Real-time (Yjs/CRDT + websockets) is the right long-term answer but wouldn't fit the timebox alongside everything else. | Two simultaneous editors: the second one to save gets a "reload" banner and must re-apply their latest few seconds of edits. Renames are last-write-wins (low stakes, so they don't bump the version). |
| **Mocked auth** with an HMAC-signed httpOnly cookie | Explicitly allowed by the brief. Signing means the cookie can't be forged, so the contract downstream (`userId` from a trusted cookie) is the same one real auth would provide. | Anyone can pick any account on the login page. |
| **Postgres + Drizzle** (I'd originally planned Prisma) | Durable storage that works on serverless hosting (SQLite files don't persist on Vercel). Drizzle is plain JS with no engine binaries: simpler builds, and it let me verify migrations end to end in my sandbox, where Prisma's engine download was blocked. | Slightly more verbose queries than Prisma. |
| **Upload: `.txt`, `.md`, `.docx` → new doc or insert into current doc**, 2 MB limit | The three formats people actually paste meeting notes and specs from. "Insert into current doc" goes through normal autosave, so it inherits the same permission and conflict checks with no extra server logic. | No PDF (lossy and slow to parse), no attachments stored as files. |

## Validation & error handling

- Request bodies validated with zod; document content validated against the ProseMirror schema; 1 MB content cap.
- Uploads: extension allowlist, size limit (checked before reading), `.docx` magic-byte check, NUL-byte check to reject binaries renamed to `.txt`.
- A single route wrapper turns every error into a JSON `{ error }` with the right status (400 / 401 / 403 / 404 / 409 / 413 / 415); unexpected errors are logged and return a generic 500.
- Client shows inline errors and toasts; autosave retries network failures but not 4xx (which won't fix themselves).

## What I intentionally deprioritized

- Real-time collaboration and presence
- Comments / suggestions, version history, export
- Links, images, tables in the editor
- Real authentication, email invites, link sharing
- Pagination on the dashboard (fine at internal-tool scale)

## With another 2–4 hours

1. **Version history** (snapshot on each save, restore button). The `version` column is already there, so this is mostly a `document_versions` table and a side panel. It also softens the conflict UX: "your edits are saved as a draft version" instead of "reload".
2. **Markdown/PDF export.** Cheap with the JSON model.
3. **Playwright UI tests** in CI for the share flow (I ran a scripted browser check manually; it should be committed and automated).
4. Then, as a bigger step: **real-time editing** with Yjs + a websocket provider, replacing the version check.
