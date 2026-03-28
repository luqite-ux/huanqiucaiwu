import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getSessionUser } from "@/lib/auth";
import type { UserRole } from "@/types/database";

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
  ];

  for (const r of (rows as Row[] | null) ?? []) {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    const email = p?.email ?? "";
    const cny = Number(r.amount_cny ?? r.amount ?? 0);
    const orig = Number(r.original_amount ?? cny);
    const rate = Number(r.exchange_rate ?? 1);

    ws.addRow({
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
