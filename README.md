# DocDraft

A lightweight collaborative document editor: create and format documents in the browser, import `.txt` / `.md` / `.docx` files, and share documents with other users as editors or viewers.

- **Live app:** `<YOUR_DEPLOYMENT_URL>`
- **Stack:** Next.js 16 (App Router, TypeScript) · TipTap 3 editor · PostgreSQL + Drizzle ORM · Vitest
- **More detail:** [ARCHITECTURE.md](./ARCHITECTURE.md) · [AI_WORKFLOW.md](./AI_WORKFLOW.md) · [SUBMISSION.md](./SUBMISSION.md)
- **Screenshots:** [docs/screenshots](./docs/screenshots)

## Demo accounts

Authentication is mocked: pick an account on the sign-in page, no password needed.

| User | Email | Seeded access |
|---|---|---|
| Alice Chen | `alice@docdraft.test` | Owns **Q4 Planning Notes** (shared with Bob as editor); can view Bob's **Team Retro** |
| Bob Martinez | `bob@docdraft.test` | Owns **Team Retro**; can edit **Q4 Planning Notes** |
| Carol Singh | `carol@docdraft.test` | Nothing shared; use her to confirm access is denied |

To see sharing from both sides, use two browsers (or one normal + one private window), each signed in as a different user.

## What works

| Area | Behavior |
|---|---|
| Documents | Create, rename (click the title), edit, delete (owner only), reopen from the dashboard |
| Formatting | Bold, italic, underline, strikethrough, headings H1–H3, bulleted & numbered lists, quotes, undo/redo, keyboard shortcuts |
| Saving | Autosave ~1s after you stop typing, `Ctrl/⌘+S` saves immediately, live status ("Saving…", "All changes saved"), automatic retry on network errors, warning before leaving with unsaved changes |
| Concurrent edits | Optimistic versioning: if someone else saved first, your save is rejected with a clear banner instead of silently overwriting their work |
| File upload | **Supported: `.txt`, `.md`, `.docx` up to 2 MB.** Import as a new document (dashboard) or insert into the open document (toolbar → *Insert from file*). Formatting is preserved where the editor supports it |
| Sharing | Owner shares by email as **Editor** (edit + rename) or **Viewer** (read-only), can change roles or remove people. Dashboard tabs split *Owned by me* / *Shared with me* with role badges |
| Access control | Enforced server-side on every API route. Users without access get 404 (document existence isn't leaked) |

## Run locally

Requires Node 20+ and a PostgreSQL database (local, Docker, or a free Neon/Supabase project).

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
#    set DATABASE_URL to your Postgres connection string
#    set SESSION_SECRET to any random string (16+ chars)

#    No Postgres handy? One-liner with Docker:
#    docker run -d --name docdraft-pg -e POSTGRES_HOST_AUTH_METHOD=trust -p 5432:5432 postgres:16
#    then: DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres

# 3. Create tables + seed demo users/documents (idempotent, safe to re-run)
npm run setup

# 4. Start
npm run dev          # http://localhost:3000
```

## Tests

```bash
npm test                                   # unit + API integration tests (integration needs DATABASE_URL + `npm run setup`)
BASE=http://localhost:3000 ./scripts/smoke.sh   # 39-check end-to-end API smoke test against a running server
npm run typecheck
```

- `tests/access.test.ts`: the permission matrix (owner / editor / viewer / stranger)
- `tests/convert.test.ts`: file import for each format, rejection of unsupported/disguised/oversized files, schema validation
- `tests/api.integration.test.ts`: calls the real route handlers against Postgres: stranger gets 404, viewer can't write, editor can't share or delete, stale saves get 409 and don't overwrite

## Deploy (Vercel + Neon, both free tiers)

1. Create a Neon project and copy the **pooled** connection string.
2. Import this repo in Vercel. Add environment variables `DATABASE_URL` and `SESSION_SECRET`.
3. Deploy. Vercel runs `npm run vercel-build`, which applies migrations, seeds demo data (without overwriting existing edits), and builds the app.

## Project layout

```
src/
  app/                 pages (dashboard, login, docs/[id]) and API route handlers
  components/          DocEditor (autosave), Toolbar, SharePanel, dashboard pieces
  lib/access.ts        the permission rules (pure, unit-tested)
  lib/documents.ts     DB queries; every document read returns the caller's role
  lib/content.ts       validates editor JSON against the ProseMirror schema
  lib/convert.ts       .txt/.md/.docx → editor content
  lib/session.ts       mocked auth: HMAC-signed session cookie
  db/schema.ts         users, documents, document_shares
drizzle/               SQL migrations
scripts/               migrate, seed, smoke test
tests/                 Vitest suites + upload fixtures
```

## Known limitations

- No real-time co-editing: two people can have a doc open, but the second to save sees a conflict banner and must reload (see ARCHITECTURE.md for why).
- Mocked authentication: anyone can sign in as any seeded user. Fine for a demo, not for production.
- Import drops what the editor doesn't support: images, tables, links (their text is kept), colors and fonts.
- No export, comments, or version history.
