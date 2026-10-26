import type { Role } from "@/lib/access";

const LABEL: Record<Role, string> = { owner: "Owner", editor: "Can edit", viewer: "View only" };

export function RoleBadge({ role }: { role: Role }) {
  return <span className={`badge badge-${role}`}>{LABEL[role]}</span>;
}
