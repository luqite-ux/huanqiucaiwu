"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { financeUpdateStatus } from "@/app/actions/finance";
import type { ReimbursementStatus } from "@/types/database";

export function FinanceActions({
  reimbursementId,
  currentStatus,
}: {
  reimbursementId: string;
  currentStatus: ReimbursementStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(status: ReimbursementStatus, rejectionReason?: string) {
    setError(null);
    startTransition(async () => {
      try {
        await financeUpdateStatus(reimbursementId, status, rejectionReason);
        setRejectOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  if (currentStatus === "draft") {
    return (
      <p className="text-sm text-slate-500">该单据仍为草稿，员工提交后可审核。</p>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {currentStatus === "pending" ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => run("approved")}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              审核通过
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setRejectOpen(true)}
              className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
            >
              驳回
            </button>
          </>
        ) : null}

        {currentStatus === "approved" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run("paid")}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            标记已打款
          </button>
        ) : null}
      </div>

      {rejectOpen ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label className="mb-2 block text-sm font-medium text-slate-700">
            驳回原因
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="请说明需要修改或补充的内容"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run("rejected", reason)}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm text-white hover:bg-rose-700 disabled:opacity-60"
            >
              确认驳回
            </button>
            <button
              type="button"
              onClick={() => setRejectOpen(false)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
            >
              取消
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
