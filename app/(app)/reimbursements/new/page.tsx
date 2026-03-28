import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReimbursementForm } from "@/components/ReimbursementForm";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getProfile, canSubmitReimbursement } from "@/lib/auth";
import type {
  CurrencyCode,
  ReimbursementType,
  UserRole,
} from "@/types/database";
import {
  REIMBURSEMENT_TYPE_OPTIONS,
  type ReimbursementAttachment,
} from "@/types/database";

export const dynamic = "force-dynamic";

function normalizeType(raw: string): ReimbursementType {
  return REIMBURSEMENT_TYPE_OPTIONS.includes(raw as ReimbursementType)
    ? (raw as ReimbursementType)
    : "其他";
}

/** RSC → Client 禁止出现 undefined，否则会触发生产环境 Server Components 报错 */
function toClientAttachments(rows: unknown[] | null | undefined): ReimbursementAttachment[] {
  if (!rows?.length) return [];
  return rows.map((r) => {
    const a = r as Record<string, unknown>;
    const kind = a.attachment_type === "purpose" ? "purpose" : "invoice";
    return {
      id: String(a.id),
      reimbursement_id: String(a.reimbursement_id),
      storage_path: String(a.storage_path),
      file_name: a.file_name != null ? String(a.file_name) : null,
      content_type: a.content_type != null ? String(a.content_type) : null,
      attachment_type: kind,
      created_at: String(a.created_at),
    };
  });
}

function rowToInitial(row: {
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
  exchange_rate_source?: string | null;
  description?: string | null;
}) {
  const cnyRaw = Number(row.amount_cny ?? row.amount ?? 0);
  const cnyVal = Number.isFinite(cnyRaw) ? cnyRaw : 0;
  const origRaw = Number(row.original_amount ?? row.amount ?? cnyVal);
  const origVal = Number.isFinite(origRaw) ? origRaw : cnyVal;
  const rateRaw = Number(row.exchange_rate ?? 1);
  const rateVal = Number.isFinite(rateRaw) && rateRaw > 0 ? rateRaw : 1;
  const initial = {
    id: row.id,
    title: row.title,
    expense_date: row.expense_date,
    type: normalizeType(String(row.type ?? "其他")),
    description: row.description ?? null,
    currency: (row.currency === "USD" ? "USD" : "CNY") as CurrencyCode,
    original_amount: origVal,
    exchange_rate: rateVal,
    amount_cny: cnyVal,
    exchange_rate_date: row.exchange_rate_date ?? null,
    exchange_rate_source: row.exchange_rate_source ?? null,
  };
  return JSON.parse(JSON.stringify(initial)) as typeof initial;
}

export default async function NewReimbursementPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const profile = await getProfile();
  if (!profile || !canSubmitReimbursement(profile.role as UserRole)) {
    redirect("/dashboard?denied=1");
  }

  const sp = await searchParams;
  const rawId = sp?.id;
  const editId =
    typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] : undefined;
  const supabase = await createClient();

  if (!editId) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">提交报销</h1>
            <p className="mt-1 text-sm text-slate-500">
              可先保存草稿，稍后在「我的报销」继续编辑。美元金额将按参考汇率折算为人民币（可手动调整汇率）。
            </p>
          </div>
          <Link
            href="/reimbursements/mine"
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            返回列表
          </Link>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <ReimbursementForm
            userId={user.id}
            initialId={null}
            initial={null}
            initialAttachments={[]}
          />
        </div>
      </div>
    );
  }

  const { data: row, error } = await supabase
    .from("reimbursements")
    .select("*")
    .eq("id", editId)
    .eq("user_id", user.id)
    .single();

  if (error || !row) notFound();
  if (
    row.status !== "draft" &&
    row.status !== "rejected" &&
    row.status !== "pending"
  ) {
    redirect(`/reimbursements/${editId}`);
  }

  const { data: attRows } = await supabase
    .from("reimbursement_attachments")
    .select("*")
    .eq("reimbursement_id", editId)
    .order("created_at", { ascending: false });

  const initial = rowToInitial(row);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {row.status === "rejected"
              ? "修改并重新提交"
              : row.status === "pending"
                ? "待审核：修改后重新提交"
                : "编辑报销草稿"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {row.status === "rejected"
              ? "驳回原因可在详情页查看。提交前请核对金额与附件。"
              : row.status === "pending"
                ? "财务尚未审核前可修改内容；保存后继续提交将更新提交时间。"
                : "可先保存草稿，确认无误后再提交审核。"}
          </p>
        </div>
        <Link
          href={`/reimbursements/${editId}`}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          查看详情
        </Link>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <ReimbursementForm
          userId={user.id}
          initialId={editId}
          initial={initial}
          initialAttachments={toClientAttachments(attRows ?? [])}
          editingStatus={row.status as "draft" | "pending" | "rejected"}
        />
      </div>
    </div>
  );
}
