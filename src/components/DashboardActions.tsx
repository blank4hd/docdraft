"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";

export const ACCEPTED_TYPES = ".txt,.md,.docx";
export const ACCEPTED_LABEL = ".txt, .md or .docx · max 2 MB";

export function DashboardActions() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"new" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createDoc() {
    setBusy("new");
    setError(null);
    try {
      const { document } = await api<{ document: { id: string } }>("/api/documents", {
        method: "POST",
        body: JSON.stringify({}),
      });
      router.push(`/docs/${document.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  async function importFile(file: File) {
    setBusy("import");
    setError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("mode", "new");
    try {
      const { document } = await api<{ document: { id: string } }>("/api/import", { method: "POST", body: form });
      router.push(`/docs/${document.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <div className="actions">
        <button className="btn" disabled={busy !== null} onClick={() => fileRef.current?.click()}>
          {busy === "import" ? "Importing…" : "⤒ Import file"}
        </button>
        <button className="btn btn-primary" disabled={busy !== null} onClick={createDoc}>
          {busy === "new" ? "Creating…" : "+ New document"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="sr-only"
          aria-label="Import a file as a new document"
          onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])}
        />
      </div>
      <div className="hint">Import supports {ACCEPTED_LABEL}</div>
      {error && <div className="error-text" style={{ textAlign: "right", marginTop: 4 }}>{error}</div>}
    </div>
  );
}
