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
    patch.approved_at = null;
    patch.paid_at = null;
  }
  if (status === "approved" || status === "paid") {
    patch.rejection_reason = null;
  }
  if (status === "approved") {
    patch.approved_at = new Date().toISOString();
  }
  if (status === "paid") {
    patch.paid_at = new Date().toISOString();
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

const BATCH_CAP = 200;

export async function financeBatchApprove(ids: string[]) {
  await assertFinance();
  const unique = Array.from(
    new Set(ids.map((id) => id.trim()).filter(Boolean))
  ).slice(0, BATCH_CAP);
  if (!unique.length) {
    return { updated: 0, skipped: 0 };
  }

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: updatedRows, error } = await supabase
    .from("reimbursements")
    .update({
      status: "approved",
      rejection_reason: null,
      approved_at: now,
    })
    .in("id", unique)
    .eq("status", "pending")
    .select("id");

  if (error) throw new Error(error.message);

  const updated = updatedRows ?? [];
  for (const row of updated) {
    await logAction(supabase, row.id, "审核通过（批量）", {
      status: "approved",
    });
  }

  revalidatePath("/finance");
  revalidatePath("/dashboard");
  for (const row of updated) {
    revalidatePath(`/reimbursements/${row.id}`);
  }

  return { updated: updated.length, skipped: unique.length - updated.length };
}

export async function financeBatchMarkPaid(ids: string[]) {
  await assertFinance();
  const unique = Array.from(
    new Set(ids.map((id) => id.trim()).filter(Boolean))
  ).slice(0, BATCH_CAP);
  if (!unique.length) {
    return { updated: 0, skipped: 0 };
  }

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: updatedRows, error } = await supabase
    .from("reimbursements")
    .update({
      status: "paid",
      paid_at: now,
      rejection_reason: null,
    })
    .in("id", unique)
    .eq("status", "approved")
    .select("id");

  if (error) throw new Error(error.message);

  const updated = updatedRows ?? [];
  for (const row of updated) {
    await logAction(supabase, row.id, "标记已打款（批量）", {
      status: "paid",
    });
  }

  revalidatePath("/finance");
  revalidatePath("/dashboard");
  for (const row of updated) {
    revalidatePath(`/reimbursements/${row.id}`);
  }

  return { updated: updated.length, skipped: unique.length - updated.length };
}
