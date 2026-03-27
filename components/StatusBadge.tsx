import type { ReimbursementStatus } from "@/types/database";
import { STATUS_LABEL } from "@/types/database";

const styles: Record<ReimbursementStatus, string> = {
  draft: "bg-slate-100 text-slate-700 ring-slate-500/10",
  pending: "bg-amber-50 text-amber-800 ring-amber-600/10",
  approved: "bg-emerald-50 text-emerald-800 ring-emerald-600/10",
  rejected: "bg-rose-50 text-rose-800 ring-rose-600/10",
  paid: "bg-blue-50 text-blue-800 ring-blue-600/10",
};

export function StatusBadge({ status }: { status: ReimbursementStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
