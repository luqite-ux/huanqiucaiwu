import { getProfile, canAccessFinancePage } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { UserRole } from "@/types/database";

export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  if (!profile || !canAccessFinancePage(profile.role as UserRole)) {
    redirect("/dashboard");
  }
  return children;
}
