# 内部报销管理系统

Next.js 14（App Router）+ TypeScript + Tailwind CSS + Supabase（PostgreSQL / Auth / Storage）。面向企业与员工提交报销、财务审核、打款标记与草稿提醒；**超级管理员**在后台管理用户与角色，不参与报销与审核。

## 1. 项目目录结构（摘要）

- `app/actions/admin-users.ts` — **仅 super_admin**：创建用户（Service Role + Admin API）、修改角色（会话 + RLS）
- `app/(app)/admin/users/` — 用户管理页（layout 鉴权）
- `lib/supabase/admin.ts` — 服务端 **Service Role** 客户端（禁止暴露到浏览器）
- `supabase/migrations/002_rls_split_roles.sql` — **增量 RLS**：财务审核仅 `finance_admin`；报销与上传仅 `employee`；`super_admin` 可管理 `profiles`

完整树形结构见历史版本或自行浏览仓库；`profiles` 即业务用户表（与 `auth.users` 一对一）。

## 2. 数据库设计（Supabase）

1. 新库：依次执行 `001_initial.sql`、`002_rls_split_roles.sql`。  
2. 已有旧库（只跑过 001）：务必再执行 **`002_rls_split_roles.sql`**，否则角色拆分与后台改角色策略与代码不一致。

**角色与能力（与代码、RLS 一致）**

| 角色 | 报销提交 / 草稿 | 财务审核 `/finance` | 用户管理 `/admin/users` |
|------|-----------------|---------------------|-------------------------|
| `employee` | ✅ | ❌ | ❌ |
| `finance_admin` | ❌ | ✅ | ❌ |
| `super_admin` | ❌ | ❌ | ✅ |

**首个超级管理员**：仍需在 Supabase SQL 中将某一用户 `profiles.role` 设为 `super_admin`（或通过注册后改库），之后即可在 **用户管理** 中创建其它账号并分配角色。

## 3. 环境变量

复制 `.env.local.example` 为 `.env.local`：

- `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY` — 全端可读的匿名密钥  
- **`SUPABASE_SERVICE_ROLE_KEY`** — **仅服务端**；用于「新建用户」调用 Auth Admin API；**勿**使用 `NEXT_PUBLIC_` 前缀，勿提交到公开仓库

缺省 `SUPABASE_SERVICE_ROLE_KEY` 时，创建用户接口会返回明确错误提示。

## 4. 本地运行

```bash
npm install
npm run dev
```

## 5. 部署到 Vercel

在环境变量中增加 `SUPABASE_SERVICE_ROLE_KEY`（Production / Preview 按需）。其余同原流程：配置 Supabase Auth 的 Site URL 与 Redirect URLs。

## 6. 功能对照

- **员工**：提交报销、草稿、我的报销、详情与附件签名 URL。  
- **财务**：审核列表与详情、通过 / 驳回 / 已打款（**不包含** `super_admin`）。  
- **超级管理员**：用户列表、新建用户（邮箱+密码+角色）、修改他人角色（不可在改自己角色）。

## 7. 许可证

内部使用；按需修改。
