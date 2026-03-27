"use server";

import { createClient } from "@/lib/supabase/server";
import {
  requireEmployee,
  requireAttachmentSignedUrlAccess,
} from "@/lib/auth";
import type { ReimbursementStatus, ReimbursementType } from "@/types/database";
import { revalidatePath } from "next/cache";

function formatAmount(n: number): string {
  return Number(n).toFixed(2);
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

export async function createReimbursementDraft(input: {
  title: string;
  expense_date: string;
  type: ReimbursementType;
  amount: number;
  description: string;
}) {
  const profile = await requireEmployee();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reimbursements")
    .insert({
      user_id: profile.id,
      title: input.title.trim(),
      expense_date: input.expense_date,
      type: input.type,
      amount: formatAmount(input.amount),
      description: input.description.trim() || null,
      status: "draft",
      submitted_at: null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  await logAction(supabase, data.id, "创建草稿", { title: input.title });
  revalidatePath("/dashboard");
  revalidatePath("/reimbursements/mine");
  return data.id as string;
}

export async function updateReimbursementDraft(
  id: string,
  input: {
    title: string;
    expense_date: string;
    type: ReimbursementType;
    amount: number;
    description: string;
  }
) {
  await requireEmployee();
  const supabase = await createClient();

  const { error } = await supabase
    .from("reimbursements")
    .update({
      title: input.title.trim(),
      expense_date: input.expense_date,
      type: input.type,
      amount: formatAmount(input.amount),
      description: input.description.trim() || null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  await logAction(supabase, id, "更新草稿", { title: input.title });
  revalidatePath("/dashboard");
  revalidatePath(`/reimbursements/${id}`);
  revalidatePath("/reimbursements/mine");
}

export async function submitReimbursement(id: string) {
  await requireEmployee();
  const supabase = await createClient();

  const { error } = await supabase
    .from("reimbursements")
    .update({
      status: "pending",
      submitted_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  await logAction(supabase, id, "提交审核");
  revalidatePath("/dashboard");
  revalidatePath(`/reimbursements/${id}`);
  revalidatePath("/reimbursements/mine");
  revalidatePath("/finance");
}

export async function saveDraftOrSubmit(
  id: string | null,
  input: {
    title: string;
    expense_date: string;
    type: ReimbursementType;
    amount: number;
    description: string;
  },
  mode: "draft" | "submit"
) {
  if (!id) {
    const newId = await createReimbursementDraft(input);
    if (mode === "submit") {
      await submitReimbursement(newId);
    }
    return newId;
  }
  await updateReimbursementDraft(id, input);
  if (mode === "submit") {
    await submitReimbursement(id);
  }
  return id;
}

export async function registerAttachment(input: {
  reimbursementId: string;
  storagePath: string;
  fileName: string;
  contentType: string | null;
}) {
  await requireEmployee();
  const supabase = await createClient();

  const { error } = await supabase.from("reimbursement_attachments").insert({
    reimbursement_id: input.reimbursementId,
    storage_path: input.storagePath,
    file_name: input.fileName,
    content_type: input.contentType,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/reimbursements/${input.reimbursementId}`);
}

export async function deleteAttachment(attachmentId: string, reimbursementId: string) {
  await requireEmployee();
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("reimbursement_attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .single();

  if (row?.storage_path) {
    await supabase.storage.from("reimbursement-files").remove([row.storage_path]);
  }

  await supabase.from("reimbursement_attachments").delete().eq("id", attachmentId);
  revalidatePath(`/reimbursements/${reimbursementId}`);
}

export async function deleteDraft(id: string) {
  await requireEmployee();
  const supabase = await createClient();

  const { data: attachments } = await supabase
    .from("reimbursement_attachments")
    .select("storage_path")
    .eq("reimbursement_id", id);

  const paths = (attachments ?? []).map((a) => a.storage_path).filter(Boolean);
  if (paths.length) {
    await supabase.storage.from("reimbursement-files").remove(paths);
  }

  const { error } = await supabase.from("reimbursements").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/reimbursements/mine");
}

export async function getSignedAttachmentUrl(storagePath: string) {
  await requireAttachmentSignedUrlAccess();
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("reimbursement-files")
    .createSignedUrl(storagePath, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
