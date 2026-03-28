import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types/database";

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return data as Profile | null;
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) {
    throw new Error("未登录");
  }
  return profile;
}

/** 可进入 /finance 并审核报销的角色（不含 super_admin） */
export function canAccessFinanceReview(role: UserRole): boolean {
  return role === "finance_admin";
}

/** 可打开 /finance 列表页（财务审核 + 超级管理员总览与改类型） */
export function canAccessFinancePage(role: UserRole): boolean {
  return role === "finance_admin" || role === "super_admin";
}

/** 财务或超管可打开他人报销详情（列表见 /finance；超管仅调整类型等，不参与审核按钮） */
export function canViewOthersReimbursementDetail(role: UserRole): boolean {
  return role === "finance_admin" || role === "super_admin";
}

/** 财务或超管可修改报销「类型」 */
export function canAdjustReimbursementType(role: UserRole): boolean {
  return role === "finance_admin" || role === "super_admin";
}

/** 可进入 /admin/users 管理用户 */
export function canAccessAdminUsers(role: UserRole): boolean {
  return role === "super_admin";
}

/** 可创建 / 编辑 / 提交报销 */
export function canSubmitReimbursement(role: UserRole): boolean {
  return role === "employee";
}

export async function requireEmployee(): Promise<Profile> {
  const profile = await requireProfile();
  if (!canSubmitReimbursement(profile.role as UserRole)) {
    throw new Error("当前角色不能提交或编辑报销");
  }
  return profile;
}

export async function requireFinanceReviewer(): Promise<Profile> {
  const profile = await requireProfile();
  if (!canAccessFinanceReview(profile.role as UserRole)) {
    throw new Error("仅财务管理员可执行审核操作");
  }
  return profile;
}

export async function requireSuperAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (!canAccessAdminUsers(profile.role as UserRole)) {
    throw new Error("无权执行系统管理操作");
  }
  return profile;
}

/** 可为报销附件生成签名 URL */
export function canRequestAttachmentSignedUrl(role: UserRole): boolean {
  return (
    role === "employee" || role === "finance_admin" || role === "super_admin"
  );
}

export async function requireAttachmentSignedUrlAccess(): Promise<Profile> {
  const profile = await requireProfile();
  if (!canRequestAttachmentSignedUrl(profile.role as UserRole)) {
    throw new Error("当前角色不能查看他人报销附件");
  }
  return profile;
}
