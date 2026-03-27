export type UserRole = "employee" | "finance_admin" | "super_admin";

export type ReimbursementType =
  | "餐饮"
  | "打车"
  | "差旅"
  | "采购"
  | "办公"
  | "其他";

export type ReimbursementStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "paid";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Reimbursement {
  id: string;
  user_id: string;
  title: string;
  expense_date: string;
  type: ReimbursementType;
  amount: number;
  description: string | null;
  status: ReimbursementStatus;
  rejection_reason: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReimbursementAttachment {
  id: string;
  reimbursement_id: string;
  storage_path: string;
  file_name: string | null;
  content_type: string | null;
  created_at: string;
}

export interface ReimbursementLog {
  id: string;
  reimbursement_id: string;
  actor_id: string | null;
  action: string;
  detail: Record<string, unknown> | null;
  created_at: string;
}

export const REIMBURSEMENT_TYPE_OPTIONS: ReimbursementType[] = [
  "餐饮",
  "打车",
  "差旅",
  "采购",
  "办公",
  "其他",
];

export const STATUS_LABEL: Record<ReimbursementStatus, string> = {
  draft: "草稿",
  pending: "待审核",
  approved: "已通过",
  rejected: "已驳回",
  paid: "已打款",
};

export function isFinanceReviewerRole(role: UserRole): boolean {
  return role === "finance_admin";
}

export function isSuperAdminRole(role: UserRole): boolean {
  return role === "super_admin";
}

export function isEmployeeRole(role: UserRole): boolean {
  return role === "employee";
}
