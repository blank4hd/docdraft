"use client";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={async () => {
        await api("/api/session", { method: "DELETE" }).catch(() => {});
        router.push("/login");
        router.refresh();
      }}
    >
      Switch user
    </button>
  );
}
