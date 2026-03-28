"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export async function changePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{ ok?: true; error?: string }> {
  const current = input.currentPassword;
  const next = input.newPassword;
  const confirm = input.confirmPassword;

  if (!current || !next) {
    return { error: "请填写完整" };
  }
  if (next.length < 6) {
    return { error: "新密码至少 6 位" };
  }
  if (next !== confirm) {
    return { error: "两次输入的新密码不一致" };
  }
  if (next === current) {
    return { error: "新密码不能与当前密码相同" };
  }

  const profile = await requireProfile();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? profile.email;
  if (!email) {
    return { error: "无法取得登录邮箱，请重新登录后再试" };
  }

  const { error: signErr } = await supabase.auth.signInWithPassword({
    email,
    password: current,
  });
  if (signErr) {
    return { error: "当前密码不正确" };
  }

  const { error: updErr } = await supabase.auth.updateUser({
    password: next,
  });
  if (updErr) {
    return { error: updErr.message };
  }

  return { ok: true };
}
