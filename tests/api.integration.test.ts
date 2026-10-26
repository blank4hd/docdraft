// Exercises the real route handlers against the database (needs DATABASE_URL
// and seeded users: `npm run setup`). Proves access control is enforced
// server-side, not just hidden in the UI.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("documents API (integration)", () => {
  let docs: typeof import("@/app/api/documents/route");
  let doc: typeof import("@/app/api/documents/[id]/route");
  let shares: typeof import("@/app/api/documents/[id]/shares/route");
  let cookieFor: (id: string) => string;
  let pool: import("pg").Pool;
  let docId = "";

  beforeAll(async () => {
    docs = await import("@/app/api/documents/route");
    doc = await import("@/app/api/documents/[id]/route");
    shares = await import("@/app/api/documents/[id]/shares/route");
    const session = await import("@/lib/session");
    pool = (await import("@/db")).pool;
    cookieFor = (id) => `${session.SESSION_COOKIE}=${session.encodeSession(id)}`;
  });

  afterAll(async () => {
    if (docId) await pool.query("delete from documents where id = $1", [docId]);
    await pool.end();
  });

  const req = (user: string | null, method = "GET", body?: unknown) =>
    new Request("http://test.local/api", {
      method,
      headers: { "content-type": "application/json", ...(user ? { cookie: cookieFor(user) } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const ctx = () => ({ params: Promise.resolve({ id: docId }) });
  const content = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

  it("requires a session", async () => {
    expect((await docs.GET(req(null), undefined as never)).status).toBe(401);
  });

  it("enforces owner / editor / viewer / stranger rules end to end", async () => {
    const created = await docs.POST(req("u_alice", "POST", { title: "Integration" }), undefined as never);
    expect(created.status).toBe(201);
    docId = (await created.json()).document.id;

    // Stranger can't tell the document exists.
    expect((await doc.GET(req("u_carol"), ctx())).status).toBe(404);

    // Viewer can read but not write.
    expect((await shares.POST(req("u_alice", "POST", { email: "bob@docdraft.test", role: "viewer" }), ctx())).status).toBe(201);
    expect((await doc.GET(req("u_bob"), ctx())).status).toBe(200);
    expect((await doc.PATCH(req("u_bob", "PATCH", { content: content("nope"), version: 1 }), ctx())).status).toBe(403);

    // Promote to editor: can write, still can't share or delete.
    await shares.POST(req("u_alice", "POST", { email: "bob@docdraft.test", role: "editor" }), ctx());
    const saved = await doc.PATCH(req("u_bob", "PATCH", { content: content("from bob"), version: 1 }), ctx());
    expect(saved.status).toBe(200);
    expect((await saved.json()).version).toBe(2);
    expect((await shares.POST(req("u_bob", "POST", { email: "carol@docdraft.test" }), ctx())).status).toBe(403);
    expect((await doc.DELETE(req("u_bob", "DELETE"), ctx())).status).toBe(403);

    // Alice saving on top of a stale version is rejected instead of overwriting Bob.
    const stale = await doc.PATCH(req("u_alice", "PATCH", { content: content("stale"), version: 1 }), ctx());
    expect(stale.status).toBe(409);
    const reopened = await (await doc.GET(req("u_alice"), ctx())).json();
    expect(reopened.document.content.content[0].content[0].text).toBe("from bob");
  });
});
