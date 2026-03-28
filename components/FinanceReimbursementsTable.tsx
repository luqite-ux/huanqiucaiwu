"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  financeBatchApprove,
  financeBatchMarkPaid,
} from "@/app/actions/finance";
import { AmountDisplayInline } from "@/components/AmountDisplay";
import { StatusBadge } from "@/components/StatusBadge";
import type { ReimbursementStatus } from "@/types/database";

export type FinanceTableRow = {
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

export function FinanceReimbursementsTable({
  rows,
  filterLabel,
  canBatch,
}: {
  rows: FinanceTableRow[];
  filterLabel: string;
  canBatch: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [hint, setHint] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const totalCny = useMemo(
    () =>
      rows.reduce((sum, r) => {
        const v = Number(r.amount_cny ?? r.amount ?? 0);
        return sum + (Number.isFinite(v) ? v : 0);
      }, 0),
    [rows]
  );

  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allSelected =
    rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  }

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  function runBatch(
    kind: "approve" | "paid",
    label: string
  ) {
    setHint(null);
    if (!selectedIds.length) {
      setHint("请先勾选要处理的报销单");
      return;
    }
    if (
      !window.confirm(
        `${label}：已选 ${selectedIds.length} 条（仅符合状态的会生效，其余自动跳过）`
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        const fn =
          kind === "approve" ? financeBatchApprove : financeBatchMarkPaid;
        const { updated, skipped } = await fn(selectedIds);
        setSelected(new Set());
        router.refresh();
        setHint(
          skipped > 0
            ? `已处理 ${updated} 条，${skipped} 条因状态不符未变更`
            : `已成功处理 ${updated} 条`
        );
      } catch (e) {
        setHint(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  return (
    <div className="space-y-3">
      {canBatch && rows.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="text-sm text-slate-700">
            已选{" "}
            <span className="font-semibold tabular-nums text-slate-900">
              {selected.size}
            </span>{" "}
            条
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || selected.size === 0}
              onClick={() => runBatch("approve", "批量审核通过")}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              批量审核通过
            </button>
            <button
              type="button"
              disabled={pending || selected.size === 0}
              onClick={() => runBatch("paid", "批量标记已打款")}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              批量标记已打款
            </button>
          </div>
        </div>
      ) : null}

      {hint ? (
        <p
          className="text-sm text-slate-700 aria-invalid:text-rose-600"
          role="status"
        >
          {hint}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {canBatch ? (
                  <th className="w-10 px-2 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      disabled={!rows.length || pending}
                      className="h-4 w-4 rounded border-slate-300"
                      title="全选本页"
                    />
                  </th>
                ) : null}
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
              {rows.map((r) => {
                const p = Array.isArray(r.profiles)
                  ? r.profiles[0]
                  : r.profiles;
                const who = p?.full_name || p?.email || r.user_id.slice(0, 8);
                return (
                  <tr key={r.id} className="hover:bg-slate-50/80">
                    {canBatch ? (
                      <td className="px-2 py-3 align-top">
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggle(r.id)}
                          disabled={pending}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>
                    ) : null}
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
                      <StatusBadge
                        status={r.status as ReimbursementStatus}
                      />
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
              {!rows.length ? (
                <tr>
                  <td
                    colSpan={canBatch ? 7 : 6}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    暂无记录
                  </td>
                </tr>
              ) : null}
            </tbody>
            {rows.length > 0 ? (
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50/90">
                  <td
                    colSpan={canBatch ? 4 : 3}
                    className="px-4 py-3 text-sm font-semibold text-slate-800"
                  >
                    合计（{filterLabel} · {rows.length} 条）
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-base font-bold tabular-nums text-slate-900">
                      ¥{totalCny.toFixed(2)}
                    </span>
                    <span className="ml-1 text-xs font-normal text-slate-500">
                      CNY
                    </span>
                  </td>
                  <td
                    colSpan={canBatch ? 2 : 2}
                    className="px-4 py-3 text-xs text-slate-500"
                  >
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
