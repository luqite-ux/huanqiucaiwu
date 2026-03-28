import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getSessionUser } from "@/lib/auth";
import type { UserRole } from "@/types/database";

/** 控制体积与 Serverless 耗时：单张展示尺寸、每单张数、全局张数上限 */
const IMAGE_EXT_WIDTH = 160;
const IMAGE_EXT_HEIGHT = 120;
const MAX_INVOICE_IMAGES = 2;
const MAX_PURPOSE_IMAGES = 2;
const MAX_TOTAL_EMBEDDED_IMAGES = 120;

function formatDt(v: string | null | undefined): string {
  if (!v) return "";
  try {
    return new Date(v).toLocaleString("zh-CN");
  } catch {
    return v;
  }
}

function todayFileSlug() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function imageExtensionFromAttachment(
  contentType: string | null,
  fileName: string | null
): "png" | "jpeg" | "gif" | null {
  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("png")) return "png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpeg";
  if (ct.includes("gif")) return "gif";
  const fn = (fileName ?? "").toLowerCase();
  if (fn.endsWith(".png")) return "png";
  if (fn.endsWith(".jpg") || fn.endsWith(".jpeg")) return "jpeg";
  if (fn.endsWith(".gif")) return "gif";
  return null;
}

function isPdf(contentType: string | null, fileName: string | null): boolean {
  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("pdf")) return true;
  return (fileName ?? "").toLowerCase().endsWith(".pdf");
}

type Att = {
  reimbursement_id: string;
  storage_path: string;
  file_name: string | null;
  content_type: string | null;
  attachment_type: string | null;
  created_at: string;
};

export async function GET(request: Request) {
  const user = await getSessionUser();
  const profile = await getProfile();
  if (!user || !profile) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const role = profile.role as UserRole;
  if (
    role !== "employee" &&
    role !== "finance_admin" &&
    role !== "super_admin"
  ) {
    return NextResponse.json({ error: "无导出权限" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "";

  const supabase = await createClient();
  let q = supabase
    .from("reimbursements")
    .select(
      `
      id, title, expense_date, type,
      currency, original_amount, exchange_rate, amount_cny, amount,
      exchange_rate_date, exchange_rate_source,
      description, status, rejection_reason,
      submitted_at, created_at, updated_at, approved_at, paid_at,
      user_id,
      profiles ( email, full_name )
    `
    )
    .order("created_at", { ascending: false });

  if (role === "employee") {
    q = q.eq("user_id", user.id);
  }

  if (status) {
    q = q.eq("status", status);
  }

  const { data: rows, error } = await q;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Row = {
    id: string;
    title: string;
    expense_date: string;
    type: string;
    currency: string | null;
    original_amount: string | number | null;
    exchange_rate: string | number | null;
    amount_cny: string | number | null;
    amount?: string | number | null;
    exchange_rate_date: string | null;
    exchange_rate_source: string | null;
    description: string | null;
    status: string;
    rejection_reason: string | null;
    submitted_at: string | null;
    created_at: string;
    updated_at: string;
    approved_at: string | null;
    paid_at: string | null;
    user_id: string;
    profiles:
      | { email: string | null; full_name: string | null }
      | null
      | Array<{ email: string | null; full_name: string | null }>;
  };

  const list = (rows as Row[] | null) ?? [];
  const ids = list.map((r) => r.id);

  const byReimb = new Map<string, Att[]>();
  if (ids.length > 0) {
    const { data: atts, error: attErr } = await supabase
      .from("reimbursement_attachments")
      .select("*")
      .in("reimbursement_id", ids)
      .order("created_at", { ascending: true });

    if (!attErr && atts) {
      for (const a of atts as Att[]) {
        const arr = byReimb.get(a.reimbursement_id) ?? [];
        arr.push(a);
        byReimb.set(a.reimbursement_id, arr);
      }
    }
  }

  const TEXT_COL_COUNT = 16;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("报销记录");

  ws.columns = [
    { header: "标题", key: "title", width: 28 },
    { header: "报销日期", key: "expense_date", width: 12 },
    { header: "类型", key: "type", width: 10 },
    { header: "申请人邮箱", key: "email", width: 26 },
    { header: "原始金额", key: "original_amount", width: 12 },
    { header: "币种", key: "currency", width: 8 },
    { header: "汇率", key: "exchange_rate", width: 12 },
    { header: "汇率日期", key: "exchange_rate_date", width: 12 },
    { header: "折算人民币", key: "amount_cny", width: 14 },
    { header: "状态", key: "status", width: 10 },
    { header: "说明", key: "description", width: 36 },
    { header: "驳回原因", key: "rejection_reason", width: 24 },
    { header: "提交时间", key: "submitted_at", width: 20 },
    { header: "审核通过时间", key: "approved_at", width: 20 },
    { header: "打款时间", key: "paid_at", width: 20 },
    { header: "创建时间", key: "created_at", width: 20 },
    { header: "发票图1", key: "x1", width: 22 },
    { header: "发票图2", key: "x2", width: 22 },
    { header: "用途图1", key: "x3", width: 22 },
    { header: "用途图2", key: "x4", width: 22 },
    { header: "其他附件说明", key: "extra_note", width: 28 },
  ];

  let embeddedCount = 0;

  for (const r of list) {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    const email = p?.email ?? "";
    const cny = Number(r.amount_cny ?? r.amount ?? 0);
    const orig = Number(r.original_amount ?? cny);
    const rate = Number(r.exchange_rate ?? 1);

    const all = byReimb.get(r.id) ?? [];
    const invoices = all.filter(
      (a) => (a.attachment_type ?? "invoice") === "invoice"
    );
    const purposes = all.filter((a) => a.attachment_type === "purpose");

    const pdfNotes: string[] = [];
    for (const a of all) {
      if (isPdf(a.content_type, a.file_name)) {
        pdfNotes.push(a.file_name || "PDF");
      }
    }
    const extraNote =
      pdfNotes.length > 0
        ? `非图片附件（请在系统中查看）：${pdfNotes.join("；")}`
        : "";

    const excelRow = ws.addRow({
      title: r.title,
      expense_date: r.expense_date,
      type: r.type,
      email,
      original_amount: orig,
      currency: r.currency ?? "CNY",
      exchange_rate: rate,
      exchange_rate_date: r.exchange_rate_date ?? "",
      amount_cny: cny,
      status: r.status,
      description: r.description ?? "",
      rejection_reason: r.rejection_reason ?? "",
      submitted_at: formatDt(r.submitted_at),
      approved_at: formatDt(r.approved_at),
      paid_at: formatDt(r.paid_at),
      created_at: formatDt(r.created_at),
      x1: "",
      x2: "",
      x3: "",
      x4: "",
      extra_note: extraNote,
    });

    const rowNumber = excelRow.number;
    let hasImage = false;

    const slots: {
      att: Att | undefined;
      colIndex: number;
    }[] = [
      { att: invoices[0], colIndex: TEXT_COL_COUNT + 0 },
      { att: invoices[1], colIndex: TEXT_COL_COUNT + 1 },
      { att: purposes[0], colIndex: TEXT_COL_COUNT + 2 },
      { att: purposes[1], colIndex: TEXT_COL_COUNT + 3 },
    ];

    for (const { att, colIndex } of slots) {
      if (embeddedCount >= MAX_TOTAL_EMBEDDED_IMAGES) break;
      if (!att) continue;
      if (isPdf(att.content_type, att.file_name)) continue;

      const ext = imageExtensionFromAttachment(
        att.content_type,
        att.file_name
      );
      if (!ext) continue;

      const { data: blob, error: dlErr } = await supabase.storage
        .from("reimbursement-files")
        .download(att.storage_path);

      if (dlErr || !blob) continue;

      const ab = await blob.arrayBuffer();
      const bytes = new Uint8Array(ab);
      if (bytes.length === 0) continue;

      try {
        const imageId = wb.addImage({
          base64: Buffer.from(bytes).toString("base64"),
          extension: ext,
        });

        ws.addImage(imageId, {
          tl: { col: colIndex, row: rowNumber - 1 },
          ext: { width: IMAGE_EXT_WIDTH, height: IMAGE_EXT_HEIGHT },
        });
        embeddedCount += 1;
        hasImage = true;
      } catch {
        /* 损坏或非常规格式则跳过 */
      }
    }

    if (hasImage) {
      excelRow.height = Math.max(
        excelRow.height ?? 0,
        IMAGE_EXT_HEIGHT * 0.8
      );
    }

    if (invoices.length > MAX_INVOICE_IMAGES || purposes.length > MAX_PURPOSE_IMAGES) {
      const tail: string[] = [];
      if (invoices.length > MAX_INVOICE_IMAGES) {
        tail.push(
          `另有发票类附件 ${invoices.length - MAX_INVOICE_IMAGES} 个未嵌入`
        );
      }
      if (purposes.length > MAX_PURPOSE_IMAGES) {
        tail.push(
          `另有用途截图 ${purposes.length - MAX_PURPOSE_IMAGES} 张未嵌入`
        );
      }
      const cell = excelRow.getCell("extra_note");
      const prev = String(cell.value ?? "");
      cell.value = [prev, tail.join("；")].filter(Boolean).join(" ");
    }
  }

  if (embeddedCount >= MAX_TOTAL_EMBEDDED_IMAGES) {
    ws.addRow({
      title: `【说明】嵌入图片已达上限 ${MAX_TOTAL_EMBEDDED_IMAGES} 张，其余请在系统中查看附件。`,
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  const filename = `reimbursements-${todayFileSlug()}.xlsx`;

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
