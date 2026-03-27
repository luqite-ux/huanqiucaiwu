"use server";

import { createClient } from "@/lib/supabase/server";
import { requireFinanceReviewer } from "@/lib/auth";
import type { ReimbursementStatus } from "@/types/database";
import { revalidatePath } from "next/cache";

async function assertFinance() {
  return requireFinanceReviewer();
}

async function logAction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  reimbursementId: string,
  action: string,
  detail?: Record<string, unknown>
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("reimbursement_logs").insert({
    reimbursement_id: reimbursementId,
    actor_id: user?.id ?? null,
    action,
    detail: detail ?? null,
  });
}

export async function financeUpdateStatus(
  reimbursementId: string,
  status: ReimbursementStatus,
  rejectionReason?: string
) {
  await assertFinance();
  const supabase = await createClient();

  const patch: Record<string, unknown> = { status };
  if (status === "rejected") {
    patch.rejection_reason = rejectionReason?.trim() || "未说明原因";
  }
  if (status === "approved" || status === "paid") {
    patch.rejection_reason = null;
  }

  const { error } = await supabase
    .from("reimbursements")
    .update(patch)
    .eq("id", reimbursementId);

  if (error) throw new Error(error.message);

  const actionMap: Record<string, string> = {
    approved: "审核通过",
    rejected: "驳回",
    paid: "标记已打款",
  };
  await logAction(supabase, reimbursementId, actionMap[status] ?? status, {
    status,
    rejection_reason: patch.rejection_reason,
  });

  revalidatePath("/finance");
  revalidatePath(`/reimbursements/${reimbursementId}`);
  revalidatePath("/dashboard");
}
