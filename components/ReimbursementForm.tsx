"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  saveDraftOrSubmit,
  submitReimbursement,
  registerAttachment,
  deleteAttachment,
} from "@/app/actions/reimbursements";
import { getUsdToCnyRateAction } from "@/app/actions/exchange-rate";
import { createClient } from "@/lib/supabase/client";
import {
  REIMBURSEMENT_TYPE_OPTIONS,
  type AttachmentKind,
  type CurrencyCode,
  type ReimbursementType,
} from "@/types/database";
import type { ReimbursementAttachment } from "@/types/database";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Supabase Storage object name must be ASCII-safe; 原始文件名写入 DB 的 file_name。 */
function asciiStorageObjectName(originalName: string): string {
  const lastDot = originalName.lastIndexOf(".");
  const rawExt =
    lastDot >= 0 ? originalName.slice(lastDot + 1).toLowerCase() : "";
  const ext = rawExt.replace(/[^a-z0-9]/g, "").slice(0, 8);
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const base = `${Date.now()}_${id}`;
  return ext ? `${base}.${ext}` : base;
}

type InitialReimbursement = {
  id: string;
  title: string;
  expense_date: string;
  type: ReimbursementType;
  description: string | null;
  currency: CurrencyCode;
  original_amount: number;
  exchange_rate: number;
  amount_cny: number;
  exchange_rate_date: string | null;
  exchange_rate_source: string | null;
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
  const [currency, setCurrency] = useState<CurrencyCode>(
    props.initial?.currency ?? "CNY"
  );
  const [originalAmount, setOriginalAmount] = useState(
    props.initial?.original_amount != null
      ? String(props.initial.original_amount)
      : ""
  );
  const [exchangeRate, setExchangeRate] = useState(
    props.initial?.exchange_rate != null
      ? String(props.initial.exchange_rate)
      : "1"
  );
  const [exchangeRateDate, setExchangeRateDate] = useState<string | null>(
    props.initial?.exchange_rate_date ?? null
  );
  const [exchangeRateSource, setExchangeRateSource] = useState<string | null>(
    props.initial?.exchange_rate_source ?? null
  );
  const [rateHint, setRateHint] = useState<string | null>(null);
  const prevCurrencyRef = useRef<CurrencyCode | null>(null);

  const [description, setDescription] = useState(
    props.initial?.description ?? ""
  );
  const canUpload = Boolean(id);

  const invoiceAttachments = useMemo(
    () =>
      attachments.filter(
        (a) => (a.attachment_type ?? "invoice") === "invoice"
      ),
    [attachments]
  );
  const purposeAttachments = useMemo(
    () =>
      attachments.filter((a) => a.attachment_type === "purpose"),
    [attachments]
  );

  const amountCnyPreview = useMemo(() => {
    const orig = Number(originalAmount);
    const rate = Number(exchangeRate);
    if (Number.isNaN(orig) || orig < 0) return null;
    if (currency === "CNY") return round2(orig);
    if (Number.isNaN(rate) || rate <= 0) return null;
    return round2(orig * rate);
  }, [currency, originalAmount, exchangeRate]);

  useEffect(() => {
    let cancelled = false;
    if (currency !== "USD") {
      setExchangeRate("1");
      setExchangeRateDate(null);
      setExchangeRateSource(null);
      setRateHint(null);
      prevCurrencyRef.current = currency;
      return;
    }

    const prev = prevCurrencyRef.current;

    if (prev === null && props.initial?.currency === "USD") {
      prevCurrencyRef.current = "USD";
      setRateHint(
        props.initial.exchange_rate_date
          ? `已加载保存的汇率（${props.initial.exchange_rate_date}），可按需修改`
          : "已加载保存的汇率，可按需修改"
      );
      return;
    }

    const cameFromNonUsd = prev !== null && prev !== "USD";
    prevCurrencyRef.current = "USD";

    if (!cameFromNonUsd) {
      return;
    }

    setRateHint("正在获取参考汇率…");
    void (async () => {
      const r = await getUsdToCnyRateAction();
      if (cancelled) return;
      if (r.ok) {
        setExchangeRate(String(r.rate));
        setExchangeRateDate(r.date);
        setExchangeRateSource("frankfurter");
        setRateHint(
          `已自动填入 ${r.date} Frankfurter 参考汇率（可按需手动修改）`
        );
      } else {
        setRateHint(
          `自动获取失败：${r.error}。请手动填写美元兑人民币汇率。`
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currency, props.initial]);

  function onRateManualChange(v: string) {
    setExchangeRate(v);
    setExchangeRateSource("manual");
    setRateHint("已改为手动汇率");
  }

  async function uploadFiles(
    files: FileList | null,
    reimbursementId: string,
    attachmentType: AttachmentKind
  ) {
    if (!files?.length) return;
    const supabase = createClient();
    for (const file of Array.from(files)) {
      const path = `${props.userId}/${reimbursementId}/${asciiStorageObjectName(file.name)}`;
      const { error: upErr } = await supabase.storage
        .from("reimbursement-files")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw new Error(upErr.message);
      await registerAttachment({
        reimbursementId,
        storagePath: path,
        fileName: file.name,
        contentType: file.type || null,
        attachmentType,
      });
    }
  }

  function buildPayload() {
    const orig = Number(originalAmount);
    const rate = Number(exchangeRate);
    if (amountCnyPreview == null) {
      throw new Error("请填写有效金额与汇率");
    }
    return {
      title,
      expense_date: expenseDate,
      type,
      description,
      currency,
      original_amount: orig,
      exchange_rate: currency === "CNY" ? 1 : rate,
      amount_cny: amountCnyPreview,
      exchange_rate_date:
        currency === "USD" ? exchangeRateDate : null,
      exchange_rate_source:
        currency === "USD" ? exchangeRateSource : null,
    };
  }

  function run(
    mode: "draft" | "submit",
    invoiceInput: HTMLInputElement | null,
    purposeInput: HTMLInputElement | null
  ) {
    setError(null);
    if (!title.trim()) {
      setError("请填写报销标题");
      return;
    }
    if (!expenseDate) {
      setError("请选择报销日期");
      return;
    }
    const orig = Number(originalAmount);
    if (Number.isNaN(orig) || orig < 0) {
      setError("请填写有效原始金额");
      return;
    }

    let payload;
    try {
      payload = buildPayload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "金额无效");
      return;
    }

    startTransition(async () => {
      try {
        if (mode === "submit") {
          let rid = id;
          if (!rid) {
            rid = await saveDraftOrSubmit(null, payload, "draft");
          } else {
            await saveDraftOrSubmit(rid, payload, "draft");
          }
          setId(rid);
          if (invoiceInput?.files?.length) {
            await uploadFiles(invoiceInput.files, rid, "invoice");
            invoiceInput.value = "";
          }
          if (purposeInput?.files?.length) {
            await uploadFiles(purposeInput.files, rid, "purpose");
            purposeInput.value = "";
          }
          await submitReimbursement(rid);
          window.location.assign(`/reimbursements/${rid}`);
          return;
        }

        const hadNoReimbursementId = id == null;
        const newId = await saveDraftOrSubmit(id, payload, "draft");
        setId(newId);
        if (invoiceInput?.files?.length) {
          await uploadFiles(invoiceInput.files, newId, "invoice");
          invoiceInput.value = "";
        }
        if (purposeInput?.files?.length) {
          await uploadFiles(purposeInput.files, newId, "purpose");
          purposeInput.value = "";
        }
        /* 硬刷新避免 Server Action 后软导航触发的 RSC/Flight 在生产环境报 generic digest */
        if (hadNoReimbursementId) {
          window.location.assign(`/reimbursements/new?id=${newId}`);
        } else {
          window.location.reload();
        }
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
            币种
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
          >
            <option value="CNY">CNY 人民币</option>
            <option value="USD">USD 美元</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            原始金额
          </label>
          <input
            inputMode="decimal"
            value={originalAmount}
            onChange={(e) => setOriginalAmount(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
            placeholder={currency === "CNY" ? "0.00" : "0.00 USD"}
          />
        </div>
        {currency === "USD" ? (
          <div className="sm:col-span-2 rounded-lg border border-slate-100 bg-slate-50 p-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              美元兑人民币汇率（1 USD = ? CNY）
            </label>
            <input
              inputMode="decimal"
              value={exchangeRate}
              onChange={(e) => onRateManualChange(e.target.value)}
              className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
            />
            {rateHint ? (
              <p className="mt-2 text-xs text-slate-600">{rateHint}</p>
            ) : null}
          </div>
        ) : null}
        <div className="sm:col-span-2 rounded-lg border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
          <div className="font-medium">折算人民币（财务汇总口径）</div>
          {amountCnyPreview != null ? (
            <div className="mt-1 text-lg font-semibold tabular-nums">
              ¥{amountCnyPreview.toFixed(2)}
            </div>
          ) : (
            <div className="mt-1 text-emerald-800">请完善金额与汇率</div>
          )}
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
          发票 / 小票（invoice）
        </label>
        {!canUpload ? (
          <p className="text-sm text-slate-500">
            请先点击「保存草稿」生成报销单后再上传附件。
          </p>
        ) : (
          <input
            id="attach-invoice"
            type="file"
            accept="image/*,.pdf"
            multiple
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-white"
          />
        )}
        {invoiceAttachments.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm">
            {invoiceAttachments.map((a) => (
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

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          用途截图（聊天记录、订单、业务证明等）
        </label>
        {!canUpload ? (
          <p className="text-sm text-slate-500">
            请先保存草稿后再上传用途截图。
          </p>
        ) : (
          <input
            id="attach-purpose"
            type="file"
            accept="image/*,.pdf"
            multiple
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-white"
          />
        )}
        {purposeAttachments.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm">
            {purposeAttachments.map((a) => (
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
            run(
              "draft",
              document.getElementById("attach-invoice") as HTMLInputElement,
              document.getElementById("attach-purpose") as HTMLInputElement
            )
          }
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60"
        >
          保存草稿
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(
              "submit",
              document.getElementById("attach-invoice") as HTMLInputElement,
              document.getElementById("attach-purpose") as HTMLInputElement
            )
          }
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow hover:bg-slate-800 disabled:opacity-60"
        >
          提交审核
        </button>
      </div>
    </div>
  );
}
