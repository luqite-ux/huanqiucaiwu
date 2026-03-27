import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold text-slate-900">内部报销系统</h1>
          <p className="mt-2 text-sm text-slate-500">请使用公司账号登录</p>
        </div>
        <Suspense fallback={<div className="text-center text-sm text-slate-500">加载…</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
