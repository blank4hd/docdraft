import Link from "next/link";

export default function NotFound() {
  return (
    <main className="login-wrap">
      <div className="login-card">
        <h1>Document not found</h1>
        <p>It may have been deleted, or it hasn&apos;t been shared with you.</p>
        <Link href="/" className="btn btn-primary">Back to documents</Link>
      </div>
    </main>
  );
}
