import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 仅服务端使用。用于 Auth Admin API 等需绕过 RLS 的操作。
 * 勿将 SUPABASE_SERVICE_ROLE_KEY 暴露给浏览器或以 NEXT_PUBLIC_ 命名。
 */
export function createServiceRoleClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("缺少环境变量 NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!key) {
    throw new Error(
      "缺少环境变量 SUPABASE_SERVICE_ROLE_KEY。请在 .env.local 中配置 Supabase 的 service_role 密钥（且不要使用 NEXT_PUBLIC_ 前缀）。"
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
