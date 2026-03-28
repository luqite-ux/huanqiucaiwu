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
import type { ReimbursementAttachment } from "@/types/database";

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
  description: string | null;
}) {
  const cnyVal = Number(row.amount_cny ?? row.amount ?? 0);
  const origVal = Number(row.original_amount ?? row.amount ?? cnyVal);
  return {
    id: row.id,
    title: row.title,
    expense_date: row.expense_date,
    type: row.type as ReimbursementType,
    description: row.description,
    currency: (row.currency === "USD" ? "USD" : "CNY") as CurrencyCode,
    original_amount: origVal,
    exchange_rate: Number(row.exchange_rate ?? 1),
    amount_cny: cnyVal,
    exchange_rate_date: row.exchange_rate_date ?? null,
    exchange_rate_source: row.exchange_rate_source ?? null,
  };
}

export default async function NewReimbursementPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const profile = await getProfile();
  if (!profile || !canSubmitReimbursement(profile.role as UserRole)) {
    redirect("/dashboard?denied=1");
  }

  const { id: editId } = await searchParams;
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
  if (row.status !== "draft" && row.status !== "rejected") {
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
            {row.status === "rejected" ? "修改并重新提交" : "编辑报销草稿"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            驳回原因可在详情页查看。提交前请核对金额与附件。
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
          initialAttachments={
            (attRows as ReimbursementAttachment[]) ?? []
          }
        />
      </div>
    </div>
  );
}
