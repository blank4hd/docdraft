"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { Avatar } from "./Avatar";

type Share = { userId: string; name: string; email: string; color: string; role: "editor" | "viewer" };
type Person = { id: string; name: string; email: string; color: string };

export function SharePanel(props: {
  docId: string;
  docTitle: string;
  canShare: boolean;
  owner: { id: string; name: string };
  onClose: () => void;
}) {
  const { docId, canShare, onClose } = props;
  const [shares, setShares] = useState<Share[] | null>(null);
  const [directory, setDirectory] = useState<Person[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ shares: Share[] }>(`/api/documents/${docId}/shares`)
      .then((r) => setShares(r.shares))
      .catch((e) => setError(e.message));
    if (canShare) api<{ users: Person[] }>("/api/users").then((r) => setDirectory(r.users)).catch(() => {});
  }, [docId, canShare]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function run(fn: () => Promise<{ shares: Share[] }>) {
    setBusy(true);
    setError(null);
    try {
      setShares((await fn()).shares);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    const ok = await run(() =>
      api(`/api/documents/${docId}/shares`, { method: "POST", body: JSON.stringify({ email, role }) }),
    );
    if (ok) setEmail("");
  };
  const changeRole = (s: Share, r: "editor" | "viewer") =>
    run(() => api(`/api/documents/${docId}/shares`, { method: "POST", body: JSON.stringify({ email: s.email, role: r }) }));
  const remove = (s: Share) => run(() => api(`/api/documents/${docId}/shares/${s.userId}`, { method: "DELETE" }));

  const ownerPerson = directory.find((p) => p.id === props.owner.id);
  const suggestions = directory.filter((p) => p.id !== props.owner.id && !shares?.some((s) => s.userId === p.id));

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <h2 id="share-title">Share “{props.docTitle}”</h2>
        <p className="modal-sub">
          {canShare
            ? "Editors can change content and rename. Viewers can only read."
            : "Only the owner can change who has access."}
        </p>

        {canShare && (
          <form className="share-form" onSubmit={add}>
            <input
              className="input"
              type="email"
              placeholder="Add people by email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              list="share-directory"
              aria-label="Email address"
              autoFocus
            />
            <datalist id="share-directory">
              {suggestions.map((p) => (
                <option key={p.id} value={p.email}>{p.name}</option>
              ))}
            </datalist>
            <select className="select" value={role} onChange={(e) => setRole(e.target.value as "editor" | "viewer")} aria-label="Access level">
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button className="btn btn-primary" disabled={busy || !email.trim()}>Share</button>
          </form>
        )}
        {error && <div className="error-text">{error}</div>}

        <ul className="people">
          <li className="person">
            <Avatar name={props.owner.name} color={ownerPerson?.color ?? "#8b877c"} />
            <span className="person-main">
              {props.owner.name}
              <small>{ownerPerson?.email ?? ""}</small>
            </span>
            <span className="badge badge-owner">Owner</span>
          </li>
          {shares === null && <li className="person muted">Loading…</li>}
          {shares?.map((s) => (
            <li key={s.userId} className="person">
              <Avatar name={s.name} color={s.color} />
              <span className="person-main">
                {s.name}
                <small>{s.email}</small>
              </span>
              {canShare ? (
                <>
                  <select
                    className="select"
                    value={s.role}
                    disabled={busy}
                    onChange={(e) => changeRole(s, e.target.value as "editor" | "viewer")}
                    aria-label={`Access level for ${s.name}`}
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button className="btn btn-ghost btn-sm btn-danger" disabled={busy} onClick={() => remove(s)}>
                    Remove
                  </button>
                </>
              ) : (
                <span className={`badge badge-${s.role}`}>{s.role === "editor" ? "Can edit" : "View only"}</span>
              )}
            </li>
          ))}
          {shares?.length === 0 && <li className="person muted">Not shared with anyone yet.</li>}
        </ul>

        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
