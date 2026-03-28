import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getSessionUser } from "@/lib/auth";
import { ExportReimbursementsButton } from "@/components/ExportReimbursementsButton";
import { FinanceReimbursementsTable } from "@/components/FinanceReimbursementsTable";
import type { ReimbursementStatus, UserRole } from "@/types/database";
import { isFinanceReviewerRole } from "@/types/database";

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
  const canBatchFinance = isFinanceReviewerRole(profile.role as UserRole);

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

      <FinanceReimbursementsTable
        rows={list}
        filterLabel={filterLabel}
        canBatch={canBatchFinance}
      />
    </div>
  );
}
