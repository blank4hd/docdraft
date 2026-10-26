import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import { LoginPicker } from "@/components/LoginPicker";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  const all = await db
    .select({ id: users.id, name: users.name, email: users.email, color: users.color })
    .from(users)
    .orderBy(asc(users.name));

  return (
    <main className="login-wrap">
      <div className="login-card">
        <span className="brand">
          <span className="brand-mark">D</span> DocDraft
        </span>
        <h1>Sign in</h1>
        <p>Choose a demo account. Open a second browser (or a private window) as another user to try sharing.</p>
        <LoginPicker users={all} />
        <p className="login-note">Demo authentication: accounts are seeded and no password is required.</p>
      </div>
    </main>
  );
}
