import Link from "next/link";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export default function AccountSecurityPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">账号安全</h1>
        <p className="mt-1 text-sm text-slate-500">
          修改登录密码。请勿与他人共享密码。
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">修改密码</h2>
        <div className="mt-4">
          <ChangePasswordForm />
        </div>
      </div>

      <Link
        href="/dashboard"
        className="text-sm text-slate-600 hover:text-slate-900"
      >
        ← 返回工作台
      </Link>
    </div>
  );
}
