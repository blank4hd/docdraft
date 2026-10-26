import { describe, expect, it } from "vitest";
import { permissionsFor, resolveRole } from "@/lib/access";

const doc = { ownerId: "u_alice" };

describe("resolveRole", () => {
  it("owner always wins, even if a share row also exists", () => {
    expect(resolveRole(doc, "u_alice", "viewer")).toBe("owner");
  });
  it("uses the share role for collaborators", () => {
    expect(resolveRole(doc, "u_bob", "editor")).toBe("editor");
    expect(resolveRole(doc, "u_bob", "viewer")).toBe("viewer");
  });
  it("denies strangers and anonymous users", () => {
    expect(resolveRole(doc, "u_carol", null)).toBeNull();
    expect(resolveRole(doc, null, "editor")).toBeNull();
  });
});

describe("permissionsFor", () => {
  it.each([
    ["owner", { canView: true, canEdit: true, canShare: true, canDelete: true }],
    ["editor", { canView: true, canEdit: true, canShare: false, canDelete: false }],
    ["viewer", { canView: true, canEdit: false, canShare: false, canDelete: false }],
    [null, { canView: false, canEdit: false, canShare: false, canDelete: false }],
  ] as const)("%s", (role, expected) => {
    expect(permissionsFor(role)).toEqual(expected);
  });
});
