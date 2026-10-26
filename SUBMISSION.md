# Submission: DocDraft

- **GitHub:** https://github.com/blank4hd/docdraft
- **Live app:** `https://docdraft.vercel.app`
- **Walkthrough video:** see `VIDEO_URL.txt`
- **Source:** this folder

## Test accounts

No passwords: choose a user on the sign-in page. Use two browser windows to see both sides of sharing.

| User         | Email                 | Starting state                                                  |
| ------------ | --------------------- | --------------------------------------------------------------- |
| Alice Chen   | `alice@docdraft.test` | Owns _Q4 Planning Notes_ (Bob = editor); viewer on _Team Retro_ |
| Bob Martinez | `bob@docdraft.test`   | Owns _Team Retro_; editor on _Q4 Planning Notes_                |
| Carol Singh  | `carol@docdraft.test` | No access to anything; use to verify denial                     |

**Suggested 2-minute review path:** sign in as Alice → open _Q4 Planning Notes_, format some text, watch "All changes saved" → Share with `carol@docdraft.test` as Viewer → in a private window sign in as Carol → _Shared with me_ → document opens read-only.

## What's included

| File / folder       | Contents                                                      |
| ------------------- | ------------------------------------------------------------- |
| `README.md`         | Features, local setup and run instructions, tests, deployment |
| `ARCHITECTURE.md`   | What I prioritized, key decisions and tradeoffs, what's next  |
| `AI_WORKFLOW.md`    | AI tools used, what I changed/rejected, how I verified        |
| `SUBMISSION.md`     | This file                                                     |
| `VIDEO_URL.txt`     | Walkthrough video link                                        |
| `src/`              | Next.js app: pages, API routes, components, lib               |
| `drizzle/`          | SQL migrations                                                |
| `scripts/`          | `migrate.ts`, `seed.ts`, `smoke.sh` (end-to-end API check)    |
| `tests/`            | Vitest unit + integration tests, upload fixtures              |
| `docs/screenshots/` | Login, dashboard, editor, share dialog, viewer mode           |

## Status

**Working end to end:** create / rename / edit / delete / reopen documents · rich text (bold, italic, underline, strike, H1–H3, lists, quotes) · autosave with retry and conflict detection · import `.txt` / `.md` / `.docx` as a new doc or into an open doc · sharing as editor or viewer, role changes, removal · owned vs shared views · server-side access control · persistence in Postgres · automated tests.

**Stretch completed:** role-based sharing (editor vs viewer).

**Not built (intentional):** real-time co-editing, comments, version history, export, links/images/tables, real auth.

**Next 2–4 hours:** version history with restore → Markdown/PDF export → automated Playwright UI tests in CI. Details in `ARCHITECTURE.md`.
