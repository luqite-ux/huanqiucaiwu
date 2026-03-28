import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getSessionUser } from "@/lib/auth";
import { StatusBadge } from "@/components/StatusBadge";
import { AmountDisplayInline } from "@/components/AmountDisplay";
import { ExportReimbursementsButton } from "@/components/ExportReimbursementsButton";
import type { ReimbursementStatus } from "@/types/database";

const FILTERS: { key: ReimbursementStatus | ""; label: string }[] = [
  { key: "pending", label: "待审核" },
  { key: "approved", label: "已通过" },
  { key: "rejected", label: "已驳回" },
  { key: "paid", label: "已打款" },
  { key: "draft", label: "草稿" },
  { key: "", label: "全部" },
];

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getSessionUser();
  const profile = await getProfile();
  if (!user || !profile) redirect("/login");

  const { status: raw } = await searchParams;
  const status =
    FILTERS.find((f) => f.key === raw)?.key ?? ("" as const);

  const isSuperAdmin = profile.role === "super_admin";

  const supabase = await createClient();
  let q = supabase
    .from("reimbursements")
    .select(
      `
      id, title, expense_date, type,
      currency, original_amount, exchange_rate, amount_cny, amount,
      exchange_rate_date, exchange_rate_source,
      status, created_at, updated_at, user_id,
      profiles ( full_name, email )
    `
    )
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

  type Row = {
    id: string;
    title: string;
    expense_date: string;
    type: string;
    currency?: string | null;
    original_amount?: string | number | null;
    exchange_rate?: string | number | null;
    amount_cny?: string | number | null;
    amount?: string | number | null;
    exchange_rate_date?: string | null;
    status: string;
    user_id: string;
    profiles:
      | { full_name: string | null; email: string | null }
      | null
      | Array<{ full_name: string | null; email: string | null }>;
  };

  const list = (rows as Row[] | null) ?? [];
  const totalCny = list.reduce((sum, r) => {
    const v = Number(r.amount_cny ?? r.amount ?? 0);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);
  const filterLabel =
    FILTERS.find((f) => f.key === status)?.label ?? "全部";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {isSuperAdmin ? "报销列表" : "财务审核"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isSuperAdmin
              ? "可浏览全部报销、导出数据，并在详情中修正「类型」。通过、驳回、打款请使用财务账号操作。"
              : "查看全部报销申请，按状态筛选；导出与当前筛选一致。"}
          </p>
        </div>
        <ExportReimbursementsButton
          statusFilter={status || undefined}
          label="导出 Excel（当前筛选）"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const href =
            f.key === "" ? "/finance" : `/finance?status=${f.key}`;
          const active = status === f.key;
          return (
            <Link
              key={f.key || "all"}
              href={href}
              className={`rounded-full px-3 py-1 text-sm ${
                active
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">标题</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">
                  提交人
                </th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">
                  日期
                </th>
                <th className="px-4 py-3 font-medium">金额（折合 CN¥）</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((r) => {
                const p = Array.isArray(r.profiles)
                  ? r.profiles[0]
                  : r.profiles;
                const who = p?.full_name || p?.email || r.user_id.slice(0, 8);
                return (
                  <tr key={r.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {r.title}
                      </div>
                      <div className="text-xs text-slate-500">{r.type}</div>
                    </td>
                    <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                      {who}
                    </td>
                    <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">
                      {r.expense_date}
                    </td>
                    <td className="px-4 py-3">
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
                );
              })}
              {!list.length ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    暂无记录
                  </td>
                </tr>
              ) : null}
            </tbody>
            {list.length > 0 ? (
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50/90">
                  <td
                    colSpan={3}
                    className="px-4 py-3 text-sm font-semibold text-slate-800"
                  >
                    合计（{filterLabel} · {list.length} 条）
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-base font-bold tabular-nums text-slate-900">
                      ¥{totalCny.toFixed(2)}
                    </span>
                    <span className="ml-1 text-xs font-normal text-slate-500">
                      CNY
                    </span>
                  </td>
                  <td colSpan={2} className="px-4 py-3 text-xs text-slate-500">
                    财务打款请以折合人民币汇总为准
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
    </div>
  );
}
