"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminCreateUser, adminUpdateUser } from "@/app/actions/admin-users";
import type { Profile, UserRole } from "@/types/database";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "employee", label: "employee（员工）" },
  { value: "finance_admin", label: "finance_admin（财务）" },
  { value: "super_admin", label: "super_admin（系统管理员）" },
];

function roleLabel(r: UserRole) {
  return ROLE_OPTIONS.find((x) => x.value === r)?.label ?? r;
}

function normName(v: string | null | undefined) {
  return (v ?? "").trim();
}

export function AdminUsersPanel(props: {
  users: Profile[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );
  const [draftRoles, setDraftRoles] = useState<Record<string, UserRole>>({});
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});

  const sorted = useMemo(
    () =>
      [...props.users].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [props.users]
  );

  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createFullName, setCreateFullName] = useState("");
  const [createRole, setCreateRole] = useState<UserRole>("employee");

  function nameDraft(u: Profile) {
    if (draftNames[u.id] !== undefined) return draftNames[u.id] ?? "";
    return u.full_name ?? "";
  }

  function rowDirty(u: Profile) {
    const disabledRow = u.id === props.currentUserId;
    const draft = draftRoles[u.id] ?? u.role;
    const nv = nameDraft(u).trim();
    const nameChanged = nv !== normName(u.full_name);
    const roleChanged = !disabledRow && draft !== u.role;
    return nameChanged || roleChanged;
  }

  return (
    <div className="space-y-10">
      {msg ? (
        <div
          role="alert"
          className={
            msg.type === "ok"
              ? "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
              : "rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
          }
        >
          {msg.text}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">新建用户</h2>
        <p className="mt-1 text-sm text-slate-500">
          将同步创建登录账号并写入角色与姓名；用户首次请使用下方邮箱与密码登录。
        </p>
        <form
          className="mt-6 grid max-w-xl gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            setMsg(null);
            startTransition(async () => {
              const res = await adminCreateUser({
                email: createEmail,
                password: createPassword,
                role: createRole,
                fullName: createFullName,
              });
              if ("error" in res && res.error) {
                setMsg({ type: "err", text: res.error });
                return;
              }
              setMsg({ type: "ok", text: "用户已创建" });
              setCreateEmail("");
              setCreatePassword("");
              setCreateFullName("");
              setCreateRole("employee");
              router.refresh();
            });
          }}
        >
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              姓名
            </label>
            <input
              type="text"
              required
              value={createFullName}
              onChange={(e) => setCreateFullName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="真实姓名或常用称呼"
              autoComplete="off"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              邮箱
            </label>
            <input
              type="email"
              required
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              autoComplete="off"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              密码
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              autoComplete="new-password"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              角色
            </label>
            <select
              value={createRole}
              onChange={(e) => setCreateRole(e.target.value as UserRole)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {pending ? "创建中…" : "创建用户"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">用户列表</h2>
        <p className="mt-1 text-sm text-slate-500">
          可修改成员姓名与角色；修改后点击「保存」生效。不能在此修改当前登录管理员自身角色，但可修改自己的显示名。
        </p>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-slate-500">
              <tr>
                <th className="pb-2 pr-4 font-medium">姓名</th>
                <th className="pb-2 pr-4 font-medium">邮箱</th>
                <th className="pb-2 pr-4 font-medium">当前角色</th>
                <th className="pb-2 pr-4 font-medium">创建时间</th>
                <th className="pb-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((u) => {
                const draft = draftRoles[u.id] ?? u.role;
                const disabledRow = u.id === props.currentUserId;
                return (
                  <tr key={u.id} className="align-middle">
                    <td className="max-w-[10rem] py-3 pr-4">
                      <input
                        type="text"
                        value={nameDraft(u)}
                        onChange={(e) =>
                          setDraftNames((prev) => ({
                            ...prev,
                            [u.id]: e.target.value,
                          }))
                        }
                        className="w-full min-w-[8rem] rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                        placeholder="姓名"
                      />
                    </td>
                    <td className="py-3 pr-4 text-slate-900">
                      {u.email || u.id.slice(0, 8)}
                    </td>
                    <td className="py-3 pr-4">
                      {disabledRow ? (
                        <span className="text-slate-600">
                          {roleLabel(u.role)}
                        </span>
                      ) : (
                        <select
                          value={draft}
                          onChange={(e) =>
                            setDraftRoles((prev) => ({
                              ...prev,
                              [u.id]: e.target.value as UserRole,
                            }))
                          }
                          className="max-w-xs rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                        >
                          {ROLE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-slate-600">
                      {new Date(u.created_at).toLocaleString("zh-CN")}
                    </td>
                    <td className="py-3">
                      {disabledRow ? (
                        <button
                          type="button"
                          disabled={pending || !rowDirty(u)}
                          onClick={() => {
                            setMsg(null);
                            startTransition(async () => {
                              const res = await adminUpdateUser({
                                userId: u.id,
                                role: u.role,
                                fullName: nameDraft(u).trim(),
                              });
                              if ("error" in res && res.error) {
                                setMsg({ type: "err", text: res.error });
                                return;
                              }
                              setMsg({ type: "ok", text: "姓名已更新" });
                              setDraftNames((prev) => {
                                const next = { ...prev };
                                delete next[u.id];
                                return next;
                              });
                              router.refresh();
                            });
                          }}
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                          保存
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={pending || !rowDirty(u)}
                          onClick={() => {
                            setMsg(null);
                            startTransition(async () => {
                              const res = await adminUpdateUser({
                                userId: u.id,
                                role: draft,
                                fullName: nameDraft(u).trim(),
                              });
                              if ("error" in res && res.error) {
                                setMsg({ type: "err", text: res.error });
                                return;
                              }
                              setMsg({ type: "ok", text: "已保存" });
                              setDraftRoles((prev) => {
                                const next = { ...prev };
                                delete next[u.id];
                                return next;
                              });
                              setDraftNames((prev) => {
                                const next = { ...prev };
                                delete next[u.id];
                                return next;
                              });
                              router.refresh();
                            });
                          }}
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                          保存
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
