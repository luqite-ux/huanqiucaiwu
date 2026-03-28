import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getProfile, canSubmitReimbursement } from "@/lib/auth";
import type { UserRole } from "@/types/database";
import { StatusBadge } from "@/components/StatusBadge";
import { AmountDisplayInline } from "@/components/AmountDisplay";
import { ExportReimbursementsButton } from "@/components/ExportReimbursementsButton";
import type { ReimbursementStatus } from "@/types/database";

const STATUSES: { key: ReimbursementStatus | ""; label: string }[] = [
  { key: "", label: "全部" },
  { key: "draft", label: "草稿" },
  { key: "pending", label: "待审核" },
  { key: "approved", label: "已通过" },
  { key: "rejected", label: "已驳回" },
  { key: "paid", label: "已打款" },
];

export default async function MineReimbursementsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const profile = await getProfile();
  if (!profile || !canSubmitReimbursement(profile.role as UserRole)) {
    redirect("/dashboard?denied=1");
  }

  const { status: raw } = await searchParams;
  const status =
    STATUSES.find((s) => s.key === raw)?.key ?? ("" as const);

  const supabase = await createClient();
  let q = supabase
    .from("reimbursements")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (status) {
    q = q.eq("status", status);
  }

  const { data: rows, error } = await q;

  if (error) {
    return (
      <p className="text-sm text-rose-600">加载失败：{error.message}</p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">我的报销</h1>
          <p className="mt-1 text-sm text-slate-500">
            列表金额以折算人民币为准；美元报销会显示汇率信息。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ExportReimbursementsButton
            statusFilter={status || undefined}
            label="导出 Excel（当前筛选项）"
          />
          <Link
            href="/reimbursements/new"
            className="inline-flex justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            新建报销
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => {
          const href =
            s.key === ""
              ? "/reimbursements/mine"
              : `/reimbursements/mine?status=${s.key}`;
          const active = status === s.key;
          return (
            <Link
              key={s.key || "all"}
              href={href}
              className={`rounded-full px-3 py-1 text-sm ${
                active
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {s.label}
            </Link>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">标题</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">
                日期
              </th>
              <th className="px-4 py-3 font-medium">金额（折合 CN¥）</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(rows ?? []).map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/80">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{r.title}</div>
                  <div className="text-xs text-slate-500">{r.type}</div>
                </td>
                <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">
                  {r.expense_date}
                </td>
                <td className="px-4 py-3 text-slate-800">
                  <AmountDisplayInline row={r} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status as ReimbursementStatus} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/reimbursements/${r.id}`}
                    className="text-brand-accent hover:underline"
                  >
                    详情
                  </Link>
                </td>
              </tr>
            ))}
            {!rows?.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  暂无记录
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
