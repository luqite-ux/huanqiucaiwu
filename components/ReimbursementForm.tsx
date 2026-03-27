"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  saveDraftOrSubmit,
  submitReimbursement,
  registerAttachment,
  deleteAttachment,
} from "@/app/actions/reimbursements";
import { createClient } from "@/lib/supabase/client";
import {
  REIMBURSEMENT_TYPE_OPTIONS,
  type ReimbursementType,
} from "@/types/database";
import type { ReimbursementAttachment } from "@/types/database";

type InitialReimbursement = {
  id: string;
  title: string;
  expense_date: string;
  type: ReimbursementType;
  amount: number;
  description: string | null;
};

export function ReimbursementForm(props: {
  userId: string;
  initialId: string | null;
  initial: InitialReimbursement | null;
  initialAttachments: ReimbursementAttachment[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [id, setId] = useState<string | null>(props.initialId);
  const [attachments, setAttachments] = useState(props.initialAttachments);

  const [title, setTitle] = useState(props.initial?.title ?? "");
  const [expenseDate, setExpenseDate] = useState(
    props.initial?.expense_date ?? new Date().toISOString().slice(0, 10)
  );
  const [type, setType] = useState<ReimbursementType>(
    props.initial?.type ?? "餐饮"
  );
  const [amount, setAmount] = useState(
    props.initial?.amount != null ? String(props.initial.amount) : ""
  );
  const [description, setDescription] = useState(
    props.initial?.description ?? ""
  );
  const canUpload = Boolean(id);

  async function uploadFiles(files: FileList | null, reimbursementId: string) {
    if (!files?.length) return;
    const supabase = createClient();
    for (const file of Array.from(files)) {
      const safeName = file.name.replace(/[^\w.\-()\u4e00-\u9fa5]/g, "_");
      const path = `${props.userId}/${reimbursementId}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("reimbursement-files")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw new Error(upErr.message);
      await registerAttachment({
        reimbursementId,
        storagePath: path,
        fileName: file.name,
        contentType: file.type || null,
      });
    }
  }

  function run(
    mode: "draft" | "submit",
    fileInput: HTMLInputElement | null
  ) {
    setError(null);
    const amt = Number(amount);
    if (!title.trim()) {
      setError("请填写报销标题");
      return;
    }
    if (!expenseDate) {
      setError("请选择报销日期");
      return;
    }
    if (Number.isNaN(amt) || amt < 0) {
      setError("请填写有效金额");
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          title,
          expense_date: expenseDate,
          type,
          amount: amt,
          description,
        };

        if (mode === "submit") {
          let rid = id;
          if (!rid) {
            rid = await saveDraftOrSubmit(null, payload, "draft");
          } else {
            await saveDraftOrSubmit(rid, payload, "draft");
          }
          setId(rid);
          if (fileInput?.files?.length) {
            await uploadFiles(fileInput.files, rid);
            fileInput.value = "";
          }
          await submitReimbursement(rid);
          router.push(`/reimbursements/${rid}`);
          router.refresh();
          return;
        }

        const newId = await saveDraftOrSubmit(id, payload, "draft");
        setId(newId);
        if (fileInput?.files?.length) {
          await uploadFiles(fileInput.files, newId);
          fileInput.value = "";
        }
        router.replace(`/reimbursements/new?id=${newId}`);
        router.refresh();
        const supabase = createClient();
        const { data } = await supabase
          .from("reimbursement_attachments")
          .select("*")
          .eq("reimbursement_id", newId)
          .order("created_at", { ascending: false });
        setAttachments((data as ReimbursementAttachment[]) ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存失败");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            报销标题
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
            placeholder="例如：客户接待餐饮"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            报销日期
          </label>
          <input
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            报销类型
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ReimbursementType)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
          >
            {REIMBURSEMENT_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            金额（元）
          </label>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
            placeholder="0.00"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            说明
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
            placeholder="费用说明、参与人员、客户名称等"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          发票 / 小票图片
        </label>
        {!canUpload ? (
          <p className="text-sm text-slate-500">
            请先点击「保存草稿」生成报销单后再上传附件。
          </p>
        ) : (
          <input
            id="attach-input"
            type="file"
            accept="image/*,.pdf"
            multiple
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-white"
          />
        )}
        {attachments.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm">
            {attachments.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2"
              >
                <span className="truncate text-slate-700">
                  {a.file_name || a.storage_path}
                </span>
                <button
                  type="button"
                  className="text-rose-600 hover:underline"
                  onClick={() => {
                    if (!id) return;
                    startTransition(async () => {
                      try {
                        await deleteAttachment(a.id, id);
                        setAttachments((prev) =>
                          prev.filter((x) => x.id !== a.id)
                        );
                        router.refresh();
                      } catch (e) {
                        setError(
                          e instanceof Error ? e.message : "删除附件失败"
                        );
                      }
                    });
                  }}
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run("draft", document.getElementById("attach-input") as HTMLInputElement)
          }
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60"
        >
          保存草稿
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run("submit", document.getElementById("attach-input") as HTMLInputElement)
          }
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow hover:bg-slate-800 disabled:opacity-60"
        >
          提交审核
        </button>
      </div>
    </div>
  );
}
