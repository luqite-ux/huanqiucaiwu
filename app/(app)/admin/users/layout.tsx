import { getProfile, canAccessAdminUsers } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { UserRole } from "@/types/database";

export default async function AdminUsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  if (!profile || !canAccessAdminUsers(profile.role as UserRole)) {
    redirect("/dashboard");
  }
  return children;
}
