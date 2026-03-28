"use client";

import { useState } from "react";
import { changePasswordAction } from "@/app/actions/account";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ChangePasswordForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  return (
    <form
      className="max-w-md space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        const fd = new FormData(e.currentTarget);
        const currentPassword = String(fd.get("currentPassword") ?? "");
        const newPassword = String(fd.get("newPassword") ?? "");
        const confirmPassword = String(fd.get("confirmPassword") ?? "");
        setPending(true);
        void (async () => {
          const res = await changePasswordAction({
            currentPassword,
            newPassword,
            confirmPassword,
          });
          setPending(false);
          if ("error" in res && res.error) {
            setMsg({ type: "err", text: res.error });
            return;
          }
          setMsg({
            type: "ok",
            text: "密码已更新。即将跳转登录页，请使用新密码重新登录。",
          });
          e.currentTarget.reset();
          await new Promise((r) => setTimeout(r, 1200));
          const supabase = createClient();
          await supabase.auth.signOut();
          router.push("/login");
          router.refresh();
        })();
      }}
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          当前密码
        </label>
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          新密码
        </label>
        <input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          确认新密码
        </label>
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      {msg ? (
        <p
          role="alert"
          className={
            msg.type === "ok"
              ? "text-sm text-emerald-800"
              : "text-sm text-rose-600"
          }
        >
          {msg.text}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "提交中…" : "更新密码"}
      </button>
      <p className="text-xs text-slate-500">
        将校验当前密码正确后更新；成功后您会自动退出并跳转登录页。
      </p>
    </form>
  );
}
