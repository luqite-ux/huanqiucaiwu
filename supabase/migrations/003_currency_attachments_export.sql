-- 增量：多币种金额、附件类型、审核/打款时间、超级管理员可读全部报销（便于导出）
-- 前置：已执行 001_initial.sql。若未执行 002，下文会补全 is_super_admin 函数（与 002 一致）。

-- 多币种与折算人民币（保留 amount 与 amount_cny 同步，兼容旧代码）
ALTER TABLE public.reimbursements
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'CNY',
  ADD COLUMN IF NOT EXISTS original_amount NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(14, 6) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS amount_cny NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS exchange_rate_date DATE,
  ADD COLUMN IF NOT EXISTS exchange_rate_source TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

UPDATE public.reimbursements
SET
  currency = COALESCE(NULLIF(TRIM(currency), ''), 'CNY'),
  original_amount = COALESCE(original_amount, amount),
  exchange_rate = CASE
    WHEN exchange_rate IS NULL OR exchange_rate = 0 THEN 1
    ELSE exchange_rate
  END,
  amount_cny = COALESCE(amount_cny, amount)
WHERE original_amount IS NULL OR amount_cny IS NULL;

ALTER TABLE public.reimbursements
  ALTER COLUMN currency SET DEFAULT 'CNY',
  ALTER COLUMN currency SET NOT NULL,
  ALTER COLUMN original_amount SET NOT NULL,
  ALTER COLUMN exchange_rate SET NOT NULL,
  ALTER COLUMN amount_cny SET NOT NULL;

UPDATE public.reimbursements SET amount = amount_cny WHERE amount IS DISTINCT FROM amount_cny;

ALTER TABLE public.reimbursements
  DROP CONSTRAINT IF EXISTS reimbursements_currency_check;

ALTER TABLE public.reimbursements
  ADD CONSTRAINT reimbursements_currency_check CHECK (currency IN ('CNY', 'USD'));

-- 附件类型：发票 / 用途截图
ALTER TABLE public.reimbursement_attachments
  ADD COLUMN IF NOT EXISTS attachment_type TEXT DEFAULT 'invoice';

UPDATE public.reimbursement_attachments
SET attachment_type = 'invoice'
WHERE attachment_type IS NULL OR TRIM(attachment_type) = '';

ALTER TABLE public.reimbursement_attachments
  ALTER COLUMN attachment_type SET NOT NULL;

ALTER TABLE public.reimbursement_attachments
  DROP CONSTRAINT IF EXISTS reimbursement_attachments_type_check;

ALTER TABLE public.reimbursement_attachments
  ADD CONSTRAINT reimbursement_attachments_type_check
    CHECK (attachment_type IN ('invoice', 'purpose'));

-- RLS 策略依赖：来自 002_rls_split_roles.sql（若库中尚无则创建）
CREATE OR REPLACE FUNCTION public.is_super_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = uid AND p.role = 'super_admin'::public.user_role
  );
$$;

-- super_admin 可读取全部报销行（用于导出 Excel；详情/附件仍不可见他人单据，与现有产品逻辑一致）
DROP POLICY IF EXISTS "reimb_select_super_admin" ON public.reimbursements;

CREATE POLICY "reimb_select_super_admin"
  ON public.reimbursements FOR SELECT
  USING (public.is_super_admin(auth.uid()));
