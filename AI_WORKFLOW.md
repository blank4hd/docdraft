# AI workflow note

## Tools used

- **Claude (Opus 5.5, in the Claude app with code execution):** planning, scaffolding, most of the implementation, tests, and running verification in a sandbox with a real Postgres and a headless browser.
- **My own review:** reading every file before submitting, manual testing of the deployed app in two browsers.

## How I used it

I worked in four steps, and kept judgment calls with me at each one:

1. **Scope first.** Before any code, I had Claude read the brief and propose a stack, data model, scope cuts and a time budget. I chose the stack and agreed the cuts (no real-time, mocked auth) up front, so the build wouldn't drift.
2. **Build in layers:** schema + seed → API with access checks → UI → tests → docs, verifying each layer before the next.
3. **Verify against reality, not against the code.** Every feature was checked by running it: a 39-step API smoke test, integration tests against a real database, and a scripted browser run with screenshots.
4. **Write-up last,** from what was actually built and tested.

## Where AI materially sped things up

- Scaffolding the Next.js app, Drizzle schema, migrations and seed script: minutes instead of most of an hour.
- TipTap wiring (toolbar active states, SSR-safe editor setup) and the `.docx`/`.md` conversion pipeline, which involve several library APIs I'd otherwise have had to look up.
- Writing the smoke test, which made it cheap to re-check every permission rule after each change.
- Visual QA: screenshotting desktop and mobile views and fixing what looked wrong.

## What I changed or rejected

| AI output / default                              | What I did instead                                                                                                                          | Why                                                                                                                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan used **Prisma**                             | Switched to **Drizzle**                                                                                                                     | Prisma's engine binary download was blocked in the sandbox, so migrations couldn't be verified; Drizzle has no binaries and also simplifies the Vercel build. |
| Store editor content as **HTML** (simplest path) | Store **ProseMirror JSON**, validated server-side against the editor schema                                                                 | Exact formatting round-trip and no stored-XSS surface.                                                                                                        |
| Return **403** for documents you can't access    | **404** for no access, 403 only for "you can see it but can't do this"                                                                      | Don't leak document existence.                                                                                                                                |
| Last-write-wins autosave                         | Version-checked saves with a **409 + conflict banner**                                                                                      | Two people editing the same doc would otherwise silently overwrite each other.                                                                                |
| Plain `.txt` import                              | Fixed a bug where a trailing newline produced a stray line break, found by **inspecting the stored JSON**, not by trusting the 201 response |                                                                                                                                                               |
| First dashboard and mobile layouts               | Fixed list overflow and a clipped Share button found in **screenshots**                                                                     |                                                                                                                                                               |
| Collaborators shown only by badge                | Added "Shared with N / Private" on owned docs                                                                                               | Makes owned-vs-shared distinction visible at a glance.                                                                                                        |
| Renamed the project                              | Integration test failed: seed skipped existing users, leaving old emails in the DB. Changed the seed to upsert demo users                   | A test caught a deploy-time data bug before reviewers would have hit it                                                                                       |

## How I verified correctness, UX and reliability

- **Access control:** unit tests for the full permission matrix, plus integration tests that call the real route handlers against Postgres (stranger → 404, viewer can't write, editor can't share/delete, stale save → 409 without overwriting).
- **API behavior:** `scripts/smoke.sh`, 39 checks covering auth, forged cookies, validation errors, sharing, uploads (valid, disguised, binary, unsupported), and deletion.
- **Upload fidelity:** inspected the stored JSON for each format; confirmed `<script>` in Markdown is dropped.
- **UX:** scripted headless-browser run: create → format → autosave → reload persists; share as viewer; second user sees it read-only; third user is blocked; no console errors. Reviewed desktop and mobile screenshots.
- **Manual:** Tested the live deployment as Alice and Carol in two browsers: editing, autosave, sharing as viewer, read-only enforcement.
