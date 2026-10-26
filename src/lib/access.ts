// Single source of truth for "who can do what" on a document.
// Pure functions: no DB access, so they are trivially unit-testable and the
// API routes, server components and UI all agree on the same rules.

export type Role = "owner" | "editor" | "viewer";
export type ShareRole = Exclude<Role, "owner">;

export interface Permissions {
  canView: boolean;
  canEdit: boolean; // edit content + rename
  canShare: boolean; // add/remove/change collaborators
  canDelete: boolean;
}

const NONE: Permissions = { canView: false, canEdit: false, canShare: false, canDelete: false };

export function resolveRole(
  doc: { ownerId: string },
  userId: string | null | undefined,
  shareRole: ShareRole | null | undefined,
): Role | null {
  if (!userId) return null;
  if (doc.ownerId === userId) return "owner";
  return shareRole ?? null;
}

export function permissionsFor(role: Role | null): Permissions {
  switch (role) {
    case "owner":
      return { canView: true, canEdit: true, canShare: true, canDelete: true };
    case "editor":
      return { canView: true, canEdit: true, canShare: false, canDelete: false };
    case "viewer":
      return { canView: true, canEdit: false, canShare: false, canDelete: false };
    default:
      return NONE;
  }
}
