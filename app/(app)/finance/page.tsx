import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/StatusBadge";
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
  const { status: raw } = await searchParams;
  const status =
    FILTERS.find((f) => f.key === raw)?.key ?? ("" as const);

  const supabase = await createClient();
  let q = supabase
    .from("reimbursements")
    .select(
      "id, title, expense_date, type, amount, status, created_at, updated_at, user_id, profiles ( full_name, email )"
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
    amount: string | number;
    status: string;
    user_id: string;
    profiles:
      | { full_name: string | null; email: string | null }
      | null
      | Array<{ full_name: string | null; email: string | null }>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">财务审核</h1>
        <p className="mt-1 text-sm text-slate-500">
          查看全部报销申请，按状态筛选并进入详情处理。
        </p>
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
                <th className="px-4 py-3 font-medium">金额</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(rows as Row[] | null)?.map((r) => {
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
                    <td className="px-4 py-3 tabular-nums">
                      ¥{Number(r.amount).toFixed(2)}
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
              {!rows?.length ? (
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
          </table>
        </div>
      </div>
    </div>
  );
}
