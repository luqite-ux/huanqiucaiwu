"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { updateReimbursementTypeByStaff } from "@/app/actions/reimbursements";
import {
  REIMBURSEMENT_TYPE_OPTIONS,
  type ReimbursementType,
} from "@/types/database";

export function ReimbursementTypeStaffEditor(props: {
  reimbursementId: string;
  initialType: ReimbursementType;
}) {
  const router = useRouter();
  const [type, setType] = useState<ReimbursementType>(props.initialType);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setType(props.initialType);
  }, [props.initialType]);

  const dirty = type !== props.initialType;

  function save() {
    setError(null);
    setOk(false);
    startTransition(async () => {
      try {
        await updateReimbursementTypeByStaff(props.reimbursementId, type);
        router.refresh();
        setOk(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存失败");
      }
    });
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={type}
          onChange={(e) => {
            setOk(false);
            setType(e.target.value as ReimbursementType);
          }}
          disabled={pending}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
        >
          {REIMBURSEMENT_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "保存中…" : "保存类型"}
        </button>
      </div>
      {error ? (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
      {ok && !dirty ? (
        <p className="text-sm text-emerald-700">类型已更新</p>
      ) : null}
    </div>
  );
}
