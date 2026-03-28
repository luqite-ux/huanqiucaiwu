import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import type { UserRole } from "@/types/database";
import {
  isEmployeeRole,
  isFinanceReviewerRole,
  isSuperAdminRole,
} from "@/types/database";

export function AppNav(props: {
  role: UserRole;
  fullName: string | null;
  email: string | null;
}) {
  const { role, fullName, email } = props;

  const links: { href: string; label: string }[] = [
    { href: "/dashboard", label: "工作台" },
  ];

  if (isEmployeeRole(role)) {
    links.push(
      { href: "/reimbursements/new", label: "提交报销" },
      { href: "/reimbursements/mine", label: "我的报销" }
    );
  }

  if (isFinanceReviewerRole(role)) {
    links.push({ href: "/finance", label: "财务审核" });
  }

  if (isSuperAdminRole(role)) {
    links.push({ href: "/admin/users", label: "用户管理" });
  }

  links.push({ href: "/account/security", label: "账号安全" });

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/dashboard"
            className="text-sm font-semibold tracking-tight text-slate-900"
          >
            报销系统
          </Link>
          <nav className="flex flex-wrap gap-1 sm:gap-2">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden text-right text-xs text-slate-500 sm:block">
            <div className="font-medium text-slate-800">
              {fullName || email || "用户"}
            </div>
            <div className="capitalize">{role.replaceAll("_", " ")}</div>
          </div>
          <Link
            href="/account/security"
            className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-brand-accent transition hover:bg-slate-100 hover:text-slate-900"
          >
            修改密码
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              退出
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
