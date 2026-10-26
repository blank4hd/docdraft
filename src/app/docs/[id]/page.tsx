import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/current-user";
import { getDocumentForUser } from "@/lib/documents";
import { DocEditor } from "@/components/DocEditor";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DocPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const doc = await getDocumentForUser(id, user.id);
  if (!doc) notFound(); // also covers "exists but not shared with you"

  return (
    <DocEditor
      currentUser={{ id: user.id, name: user.name, color: user.color }}
      doc={{
        id: doc.id,
        title: doc.title,
        content: doc.content,
        version: doc.version,
        role: doc.role,
        permissions: doc.permissions,
        owner: doc.owner,
      }}
    />
  );
}
