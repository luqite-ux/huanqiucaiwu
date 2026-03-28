"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteReimbursementBySuperAdmin } from "@/app/actions/reimbursements";

export function SuperAdminDeleteReimbursement({
  reimbursementId,
}: {
  reimbursementId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canSubmit = phrase.trim() === "确认删除";

  function run() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteReimbursementBySuperAdmin(reimbursementId);
        router.push("/finance");
      } catch (e) {
        setError(e instanceof Error ? e.message : "删除失败");
      }
    });
  }

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4">
      <div className="text-sm font-medium text-rose-900">系统管理员</div>
      <p className="mt-1 text-xs text-rose-800">
        删除将永久移除该报销单、操作记录及附件文件，且不可恢复。
      </p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-800 hover:bg-rose-50"
        >
          删除报销单
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          <label className="block text-xs text-rose-900">
            请输入「确认删除」以继续
            <input
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              className="mt-1 w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm"
              placeholder="确认删除"
              autoComplete="off"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || !canSubmit}
              onClick={run}
              className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-medium text-white hover:bg-rose-800 disabled:opacity-50"
            >
              {pending ? "删除中…" : "确认永久删除"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                setPhrase("");
                setError(null);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              取消
            </button>
          </div>
        </div>
      )}
      {error ? (
        <p className="mt-2 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
