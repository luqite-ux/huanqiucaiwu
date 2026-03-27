import { AppNav } from "@/components/AppNav";
import { getProfile, getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { UserRole } from "@/types/database";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const profile = await getProfile();
  if (!profile) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-100">
      <AppNav
        role={profile.role as UserRole}
        fullName={profile.full_name}
        email={profile.email}
      />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
