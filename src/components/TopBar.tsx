import Link from "next/link";
import type { User } from "@/db/schema";
import { Avatar } from "./Avatar";
import { SignOutButton } from "./SignOutButton";

export function TopBar({ user }: { user: User }) {
  return (
    <header className="topbar">
      <Link href="/" className="brand">
        <span className="brand-mark">D</span> DocDraft
      </Link>
      <span className="topbar-spacer" />
      <span className="user-chip">
        <Avatar name={user.name} color={user.color} />
        <span>{user.name}</span>
      </span>
      <SignOutButton />
    </header>
  );
}
