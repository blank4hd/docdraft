import Link from "next/link";
import { requirePageUser } from "@/lib/current-user";
import { listDocumentsForUser, type DocSummary } from "@/lib/documents";
import { timeAgo } from "@/lib/format";
import { TopBar } from "@/components/TopBar";
import { RoleBadge } from "@/components/RoleBadge";
import { DashboardActions } from "@/components/DashboardActions";

export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePageUser();
  const { tab } = await searchParams;
  const active = tab === "shared" ? "shared" : "owned";
  const { owned, shared } = await listDocumentsForUser(user.id);
  const docs = active === "owned" ? owned : shared;

  return (
    <>
      <TopBar user={user} />
      <main className="page">
        <div className="page-head">
          <div>
            <h1>Documents</h1>
            <div className="muted">Signed in as {user.email}</div>
          </div>
          <DashboardActions />
        </div>

        <nav className="tabs" aria-label="Document filters">
          <Link href="/" className="tab" aria-current={active === "owned" ? "page" : undefined}>
            Owned by me<span className="count">{owned.length}</span>
          </Link>
          <Link href="/?tab=shared" className="tab" aria-current={active === "shared" ? "page" : undefined}>
            Shared with me<span className="count">{shared.length}</span>
          </Link>
        </nav>

        {docs.length === 0 ? (
          <div className="empty">
            {active === "owned"
              ? "You don't own any documents yet. Create one or import a file to get started."
              : "Nothing has been shared with you yet."}
          </div>
        ) : (
          <ul className="doc-list">
            {docs.map((d) => (
              <DocRow key={d.id} doc={d} />
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function DocRow({ doc }: { doc: DocSummary }) {
  return (
    <li>
      <Link href={`/docs/${doc.id}`} className="doc-row">
        <span className="doc-icon" aria-hidden>
          ¶
        </span>
        <span className="doc-main">
          <div className="doc-title">{doc.title}</div>
          <div className="doc-preview">{doc.preview || "Empty document"}</div>
        </span>
        <span className="doc-meta">
          <RoleBadge role={doc.role} />
          <span>
            {doc.role === "owner"
              ? doc.shareCount > 0
                ? `Shared with ${doc.shareCount} · `
                : "Private · "
              : `From ${doc.owner.name} · `}
            {timeAgo(doc.updatedAt)}
          </span>
        </span>
      </Link>
    </li>
  );
}
