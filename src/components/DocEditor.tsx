"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import { Placeholder } from "@tiptap/extensions";
import { editorExtensions } from "@/lib/editor/extensions";
import type { Permissions, Role } from "@/lib/access";
import { api, ApiError } from "@/lib/client-api";
import { Toolbar } from "./Toolbar";
import { SharePanel } from "./SharePanel";
import { RoleBadge } from "./RoleBadge";
import { Avatar } from "./Avatar";

type SaveStatus = "saved" | "unsaved" | "saving" | "error" | "conflict";

const SAVE_DEBOUNCE_MS = 800;
const RETRY_MS = 4000;

export interface EditorDoc {
  id: string;
  title: string;
  content: JSONContent;
  version: number;
  role: Role;
  permissions: Permissions;
  owner: { id: string; name: string };
}

export function DocEditor({ doc, currentUser }: { doc: EditorDoc; currentUser: { id: string; name: string; color: string } }) {
  const router = useRouter();
  const { canEdit, canShare, canDelete } = doc.permissions;

  const [title, setTitle] = useState(doc.title);
  const savedTitle = useRef(doc.title);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [shareOpen, setShareOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Autosave bookkeeping lives in refs so the editor callbacks never see stale state.
  const version = useRef(doc.version);
  const dirty = useRef(false);
  const inFlight = useRef(false);
  const conflicted = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRef = useRef<() => void>(() => {});

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 3500);
  }, []);

  const schedule = useCallback((ms = SAVE_DEBOUNCE_MS) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flushRef.current(), ms);
  }, []);

  const editor = useEditor({
    extensions: [
      ...editorExtensions,
      Placeholder.configure({ placeholder: canEdit ? "Start typing…" : "This document is empty." }),
    ],
    content: doc.content,
    editable: canEdit,
    immediatelyRender: false, // avoid SSR hydration mismatch
    onUpdate: () => {
      if (conflicted.current) return;
      dirty.current = true;
      setStatus("unsaved");
      schedule();
    },
  });

  const flush = useCallback(async () => {
    if (!editor || !dirty.current || inFlight.current || conflicted.current) return;
    inFlight.current = true;
    dirty.current = false;
    setStatus("saving");
    try {
      const res = await api<{ version: number }>(`/api/documents/${doc.id}`, {
        method: "PATCH",
        body: JSON.stringify({ content: editor.getJSON(), version: version.current }),
      });
      version.current = res.version;
      setStatus(dirty.current ? "unsaved" : "saved");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        conflicted.current = true;
        setStatus("conflict");
      } else if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        // Validation / permission errors won't fix themselves by retrying.
        setStatus("error");
        showToast(e.message);
      } else {
        dirty.current = true;
        setStatus("error");
        schedule(RETRY_MS);
      }
    } finally {
      inFlight.current = false;
      if (dirty.current && !conflicted.current) schedule();
    }
  }, [editor, doc.id, schedule, showToast]);
  flushRef.current = flush;

  // Ctrl/Cmd+S saves immediately instead of opening the browser's save dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        flushRef.current();
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current || inFlight.current) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function commitTitle() {
    const next = title.trim();
    if (!next) {
      setTitle(savedTitle.current);
      return;
    }
    if (next === savedTitle.current) return;
    try {
      await api(`/api/documents/${doc.id}`, { method: "PATCH", body: JSON.stringify({ title: next }) });
      savedTitle.current = next;
      setTitle(next);
    } catch (e) {
      setTitle(savedTitle.current);
      showToast((e as Error).message);
    }
  }

  async function insertFromFile(file: File) {
    if (!editor) return;
    const form = new FormData();
    form.append("file", file);
    form.append("mode", "convert");
    try {
      const { content } = await api<{ content: JSONContent }>("/api/import", { method: "POST", body: form });
      editor.chain().focus().insertContent(content.content ?? []).run();
      showToast(`Inserted “${file.name}”`);
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function deleteDoc() {
    if (!confirm(`Delete “${title}”? This can't be undone.`)) return;
    try {
      dirty.current = false;
      await api(`/api/documents/${doc.id}`, { method: "DELETE" });
      router.push("/");
      router.refresh();
    } catch (e) {
      showToast((e as Error).message);
    }
  }

  const statusLabel: Record<SaveStatus, string> = {
    saved: "All changes saved",
    unsaved: "Unsaved changes",
    saving: "Saving…",
    error: "Couldn't save — retrying",
    conflict: "Not saved",
  };

  return (
    <>
      <header className="doc-header">
        <Link href="/" className="btn btn-ghost btn-sm" title="Back to documents">←</Link>
        <input
          className="title-input"
          value={title}
          readOnly={!canEdit}
          aria-label="Document title"
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setTitle(savedTitle.current);
              requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
            }
          }}
        />
        {canEdit ? (
          <span className={`save-status ${status === "error" || status === "conflict" ? "error" : ""}`} aria-live="polite">
            {statusLabel[status]}
          </span>
        ) : (
          <RoleBadge role="viewer" />
        )}
        <span className="topbar-spacer" />
        {doc.role !== "owner" && <span className="muted owned-by" style={{ fontSize: 12.5 }}>Owned by {doc.owner.name}</span>}
        {canDelete && (
          <button className="btn btn-ghost btn-sm btn-danger" onClick={deleteDoc}>Delete</button>
        )}
        <button className="btn btn-primary btn-sm" onClick={() => setShareOpen(true)}>
          {canShare ? "Share" : "People"}
        </button>
        <Avatar name={currentUser.name} color={currentUser.color} />
      </header>

      {editor && canEdit && <Toolbar editor={editor} onInsertFile={() => fileRef.current?.click()} />}
      <input
        ref={fileRef}
        type="file"
        accept=".txt,.md,.docx"
        className="sr-only"
        aria-label="Insert content from a file"
        onChange={(e) => e.target.files?.[0] && insertFromFile(e.target.files[0])}
      />

      {status === "conflict" && (
        <div className="banner banner-warn" role="alert">
          <strong>Someone else edited this document while you were working.</strong>
          Your latest changes were not saved. Copy anything you need, then reload to get the newest version.
          <button className="btn btn-sm" onClick={() => window.location.reload()}>Reload</button>
        </div>
      )}
      {!canEdit && (
        <div className="banner banner-warn">You have view-only access. Ask {doc.owner.name} for edit access.</div>
      )}

      <main className="canvas">
        <div className="sheet">
          <EditorContent editor={editor} />
        </div>
      </main>

      {shareOpen && (
        <SharePanel
          docId={doc.id}
          docTitle={title}
          canShare={canShare}
          owner={doc.owner}
          onClose={() => setShareOpen(false)}
        />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
