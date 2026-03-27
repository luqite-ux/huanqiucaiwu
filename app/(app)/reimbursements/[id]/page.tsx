import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getProfile,
  getSessionUser,
  canAccessFinanceReview,
} from "@/lib/auth";
import { StatusBadge } from "@/components/StatusBadge";
import { FinanceActions } from "@/components/FinanceActions";
import { getSignedAttachmentUrl } from "@/app/actions/reimbursements";
import type { ReimbursementStatus, UserRole } from "@/types/database";
import { isEmployeeRole } from "@/types/database";

export default async function ReimbursementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const profile = await getProfile();
  if (!profile) redirect("/login");

  const role = profile.role as UserRole;
  const finance = canAccessFinanceReview(role);

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("reimbursements")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !row) notFound();

  const isOwner = row.user_id === user.id;
  if (!isOwner && !finance) notFound();

  const { data: submitter } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", row.user_id)
    .single();

  const { data: attachments } = await supabase
    .from("reimbursement_attachments")
    .select("*")
    .eq("reimbursement_id", id)
    .order("created_at", { ascending: true });

  const { data: logs } = await supabase
    .from("reimbursement_logs")
    .select("*")
    .eq("reimbursement_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  const attUrls = await Promise.all(
    (attachments ?? []).map(async (a) => {
      try {
        const url = await getSignedAttachmentUrl(a.storage_path);
        return { id: a.id, name: a.file_name, url };
      } catch {
        return { id: a.id, name: a.file_name, url: "#" };
      }
    })
  );

  const status = row.status as ReimbursementStatus;
  const canEdit =
    isOwner &&
    isEmployeeRole(role) &&
    (status === "draft" || status === "rejected");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900">
              {row.title}
            </h1>
            <StatusBadge status={status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            单号 {row.id.slice(0, 8)}…
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <Link
              href={`/reimbursements/new?id=${id}`}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              {status === "rejected" ? "重新编辑" : "继续编辑"}
            </Link>
          ) : null}
          <Link
            href={isOwner ? "/reimbursements/mine" : "/finance"}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 hover:bg-slate-50"
          >
            返回列表
          </Link>
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2">
        <div>
          <div className="text-xs font-medium uppercase text-slate-500">
            报销日期
          </div>
          <div className="mt-1 text-slate-900">{row.expense_date}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase text-slate-500">
            类型
          </div>
          <div className="mt-1 text-slate-900">{row.type}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase text-slate-500">
            金额
          </div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
            ¥{Number(row.amount).toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase text-slate-500">
            提交人
          </div>
          <div className="mt-1 text-slate-900">
            {submitter?.full_name || submitter?.email || row.user_id}
          </div>
        </div>
        {row.description ? (
          <div className="sm:col-span-2">
            <div className="text-xs font-medium uppercase text-slate-500">
              说明
            </div>
            <p className="mt-1 whitespace-pre-wrap text-slate-800">
              {row.description}
            </p>
          </div>
        ) : null}
        {status === "rejected" && row.rejection_reason ? (
          <div className="rounded-lg bg-rose-50 p-3 sm:col-span-2">
            <div className="text-xs font-medium text-rose-800">驳回原因</div>
            <p className="mt-1 text-sm text-rose-900">{row.rejection_reason}</p>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">附件</h2>
        {attUrls.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">无附件</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {attUrls.map((a) => (
              <li key={a.id}>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-brand-accent hover:underline"
                >
                  {a.name || "查看附件"}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {finance ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">财务操作</h2>
          <div className="mt-4">
            <FinanceActions reimbursementId={id} currentStatus={status} />
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">操作记录</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          {(logs ?? []).map((l) => (
            <li key={l.id} className="flex flex-col border-b border-slate-100 pb-2 last:border-0">
              <span className="text-slate-900">{l.action}</span>
              <span className="text-xs text-slate-400">
                {new Date(l.created_at).toLocaleString("zh-CN")}
              </span>
            </li>
          ))}
          {!logs?.length ? <li>暂无记录</li> : null}
        </ul>
      </div>
    </div>
  );
}
