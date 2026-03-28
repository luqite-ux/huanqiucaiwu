"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth";
import type { UserRole } from "@/types/database";

const ROLES: UserRole[] = ["employee", "finance_admin", "super_admin"];

function assertRole(r: string): asserts r is UserRole {
  if (!ROLES.includes(r as UserRole)) {
    throw new Error("无效的角色");
  }
}

export async function adminCreateUser(input: {
  email: string;
  password: string;
  role: UserRole;
  fullName: string;
}) {
  await requireSuperAdmin();

  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const fullName = input.fullName.trim();
  if (!email || !password) {
    return { error: "请填写邮箱和密码" as string };
  }
  if (!fullName) {
    return { error: "请填写姓名" as string };
  }
  if (password.length < 6) {
    return { error: "密码至少 6 位" as string };
  }
  assertRole(input.role);

  const admin = createServiceRoleClient();

  const { data: created, error: createErr } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (createErr || !created.user) {
    return {
      error: createErr?.message ?? "创建用户失败",
    };
  }

  const userId = created.user.id;

  const { error: profileErr } = await admin.from("profiles").upsert(
    {
      id: userId,
      email,
      role: input.role,
      full_name: fullName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (profileErr) {
    await admin.auth.admin.deleteUser(userId);
    return { error: `已创建登录账号，但写入资料失败：${profileErr.message}` };
  }

  revalidatePath("/admin/users");
  revalidatePath("/finance");
  return { ok: true as const };
}

export async function adminUpdateUser(input: {
  userId: string;
  role: UserRole;
  fullName: string;
}) {
  const adminProfile = await requireSuperAdmin();
  assertRole(input.role);

  const name = input.fullName.trim();
  if (!name) {
    return { error: "姓名不能为空" as string };
  }

  const supabase = await createClient();
  const now = new Date().toISOString();

  if (input.userId === adminProfile.id) {
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: name,
        updated_at: now,
      })
      .eq("id", input.userId);

    if (error) {
      return { error: error.message };
    }
    revalidatePath("/admin/users");
    revalidatePath("/dashboard");
    revalidatePath("/finance");
    return { ok: true as const };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: name,
      role: input.role,
      updated_at: now,
    })
    .eq("id", input.userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/users");
  revalidatePath("/dashboard");
  revalidatePath("/finance");
  return { ok: true as const };
}
