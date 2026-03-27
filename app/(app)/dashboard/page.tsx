import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getSessionUser } from "@/lib/auth";
import {
  isFinanceReviewerRole,
  isSuperAdminRole,
  isEmployeeRole,
} from "@/types/database";
import type { UserRole } from "@/types/database";

function subDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() - n);
  return x.toISOString();
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  const profile = await getProfile();
  if (!user || !profile) return null;

  const supabase = await createClient();
  const role = profile.role as UserRole;

  if (isSuperAdminRole(role)) {
    return (
      <div className="space-y-8">
        {params?.denied === "1" ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            当前角色无权访问该页面，已返回工作台。
          </div>
        ) : null}
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">系统管理台</h1>
          <p className="mt-1 text-sm text-slate-500">
            您以超级管理员身份登录，负责用户与角色配置，不参与报销提交与财务审核。
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/admin/users"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300"
          >
            <div className="text-sm font-medium text-slate-500">用户管理</div>
            <div className="mt-2 text-lg font-medium text-slate-800">
              创建账号、分配角色
            </div>
            <div className="mt-3 text-sm text-brand-accent">进入 →</div>
          </Link>
        </div>
      </div>
    );
  }

  if (isFinanceReviewerRole(role)) {
    const { count: pendingFinance } = await supabase
      .from("reimbursements")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    return (
      <div className="space-y-8">
        {params?.denied === "1" ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            当前角色无权访问该页面，已返回工作台。
          </div>
        ) : null}
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">财务工作台</h1>
          <p className="mt-1 text-sm text-slate-500">
            待您审核的报销单数量会显示在下方，请及时处理。
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/finance?status=pending"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300"
          >
            <div className="text-sm font-medium text-slate-500">待审核</div>
            <div className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">
              {pendingFinance ?? 0}
            </div>
            <div className="mt-3 text-sm text-brand-accent">进入审核 →</div>
          </Link>
          <Link
            href="/finance"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300"
          >
            <div className="text-sm font-medium text-slate-500">全部报销</div>
            <div className="mt-2 text-lg font-medium text-slate-800">
              按状态筛选记录
            </div>
            <div className="mt-3 text-sm text-brand-accent">打开列表 →</div>
          </Link>
        </div>
      </div>
    );
  }

  if (!isEmployeeRole(role)) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        未知角色，请联系管理员。
      </div>
    );
  }

  const { count: draftCount } = await supabase
    .from("reimbursements")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "draft");

  const { count: pendingCount } = await supabase
    .from("reimbursements")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "pending");

  const { count: rejectedCount } = await supabase
    .from("reimbursements")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "rejected");

  const staleBefore = subDays(new Date(), 7);
  const { count: staleDraftCount } = await supabase
    .from("reimbursements")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "draft")
    .lt("updated_at", staleBefore);

  const todo =
    (draftCount ?? 0) + (pendingCount ?? 0) + (rejectedCount ?? 0);

  return (
    <div className="space-y-8">
      {params?.denied === "1" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          当前角色无权访问该页面，已返回工作台。
        </div>
      ) : null}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">工作台</h1>
        <p className="mt-1 text-sm text-slate-500">
          您有{" "}
          <span className="font-medium text-slate-800">{todo}</span>{" "}
          条与报销相关的待办（草稿、审核中、已驳回待修改）。
        </p>
      </div>

      {(staleDraftCount ?? 0) > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          提醒：您有{" "}
          <strong>{staleDraftCount}</strong>{" "}
          条草稿已超过 7 天未提交，建议尽快完善并提交，避免遗漏报销。
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/reimbursements/mine?status=draft"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
        >
          <div className="text-sm font-medium text-slate-500">草稿箱</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">
            {draftCount ?? 0}
          </div>
        </Link>
        <Link
          href="/reimbursements/mine?status=pending"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
        >
          <div className="text-sm font-medium text-slate-500">审核中</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">
            {pendingCount ?? 0}
          </div>
        </Link>
        <Link
          href="/reimbursements/mine?status=rejected"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
        >
          <div className="text-sm font-medium text-slate-500">已驳回待处理</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">
            {rejectedCount ?? 0}
          </div>
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/reimbursements/new"
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow hover:bg-slate-800"
        >
          新建报销单
        </Link>
        <Link
          href="/reimbursements/mine"
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
        >
          查看我的报销
        </Link>
      </div>
    </div>
  );
}
