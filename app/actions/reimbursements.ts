"use server";

import { createClient } from "@/lib/supabase/server";
import {
  requireEmployee,
  requireAttachmentSignedUrlAccess,
} from "@/lib/auth";
import type {
  AttachmentKind,
  CurrencyCode,
  ReimbursementStatus,
  ReimbursementType,
} from "@/types/database";
import { revalidatePath } from "next/cache";

function formatAmount(n: number): string {
  return Number(n).toFixed(2);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

export type ReimbursementMoneyInput = {
  currency: CurrencyCode;
  original_amount: number;
  exchange_rate: number;
  amount_cny: number;
  exchange_rate_date: string | null;
  exchange_rate_source: string | null;
};

function buildMoneyRow(m: ReimbursementMoneyInput) {
  const orig = round2(m.original_amount);
  if (Number.isNaN(orig) || orig < 0) throw new Error("原始金额无效");

  if (m.currency === "CNY") {
    return {
      currency: "CNY" as const,
      original_amount: orig,
      exchange_rate: 1,
      amount_cny: orig,
      exchange_rate_date: null,
      exchange_rate_source: null,
      amount: formatAmount(orig),
    };
  }

  const rate = round6(m.exchange_rate);
  if (!rate || rate <= 0 || Number.isNaN(rate)) {
    throw new Error("美元报销须填写有效汇率");
  }
  const cny = round2(orig * rate);
  if (Math.abs(cny - round2(m.amount_cny)) > 0.02) {
    throw new Error("折算人民币与汇率不一致，请核对后重试");
  }

  return {
    currency: "USD" as const,
    original_amount: orig,
    exchange_rate: rate,
    amount_cny: cny,
    exchange_rate_date: m.exchange_rate_date,
    exchange_rate_source: m.exchange_rate_source,
    amount: formatAmount(cny),
  };
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

export type ReimbursementDraftInput = {
  title: string;
  expense_date: string;
  type: ReimbursementType;
  description: string;
} & ReimbursementMoneyInput;

export async function createReimbursementDraft(input: ReimbursementDraftInput) {
  const profile = await requireEmployee();
  const supabase = await createClient();
  const money = buildMoneyRow(input);

  const { data, error } = await supabase
    .from("reimbursements")
    .insert({
      user_id: profile.id,
      title: input.title.trim(),
      expense_date: input.expense_date,
      type: input.type,
      description: input.description.trim() || null,
      status: "draft",
      submitted_at: null,
      ...money,
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
  input: ReimbursementDraftInput
) {
  await requireEmployee();
  const supabase = await createClient();
  const money = buildMoneyRow(input);

  const { error } = await supabase
    .from("reimbursements")
    .update({
      title: input.title.trim(),
      expense_date: input.expense_date,
      type: input.type,
      description: input.description.trim() || null,
      ...money,
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
  input: ReimbursementDraftInput,
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
  attachmentType: AttachmentKind;
}) {
  await requireEmployee();
  const supabase = await createClient();

  const { error } = await supabase.from("reimbursement_attachments").insert({
    reimbursement_id: input.reimbursementId,
    storage_path: input.storagePath,
    file_name: input.fileName,
    content_type: input.contentType,
    attachment_type: input.attachmentType,
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
