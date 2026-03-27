import { createClient } from "@/lib/supabase/server";
import {
  getProfile,
  canAccessAdminUsers,
} from "@/lib/auth";
import { AdminUsersPanel } from "@/components/AdminUsersPanel";
import { redirect } from "next/navigation";
import type { Profile, UserRole } from "@/types/database";

export default async function AdminUsersPage() {
  const profile = await getProfile();
  if (!profile || !canAccessAdminUsers(profile.role as UserRole)) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <p className="text-sm text-rose-600">
        无法加载用户列表：{error.message}。请确认已在数据库执行{" "}
        <code className="rounded bg-slate-100 px-1">002_rls_split_roles.sql</code>{" "}
        且当前账号为 super_admin。
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">用户管理</h1>
        <p className="mt-1 text-sm text-slate-500">
          User Management — 分配员工与财务账号；系统管理员不参与报销与审核流程。
        </p>
      </div>

      <AdminUsersPanel
        users={(rows as Profile[]) ?? []}
        currentUserId={profile.id}
      />
    </div>
  );
}
