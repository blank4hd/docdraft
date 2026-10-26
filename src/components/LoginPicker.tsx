"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { Avatar } from "./Avatar";

type U = { id: string; name: string; email: string; color: string };

export function LoginPicker({ users }: { users: U[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(id: string) {
    setBusy(id);
    setError(null);
    try {
      await api("/api/session", { method: "POST", body: JSON.stringify({ userId: id }) });
      router.push("/");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <div>
      {users.map((u) => (
        <button key={u.id} className="user-option" disabled={busy !== null} onClick={() => signIn(u.id)}>
          <Avatar name={u.name} color={u.color} size={36} />
          <span style={{ flex: 1 }}>
            <strong>{u.name}</strong>
            <small>{u.email}</small>
          </span>
          <span className="muted">{busy === u.id ? "Signing in…" : "→"}</span>
        </button>
      ))}
      {users.length === 0 && <p className="error-text">No users found. Run <code>npm run setup</code> to seed the database.</p>}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
