-- 内部报销系统 — 初始 schema、RLS、存储桶策略
-- 在 Supabase SQL Editor 中整段执行

CREATE TYPE public.user_role AS ENUM ('employee', 'finance_admin', 'super_admin');

CREATE TYPE public.reimbursement_status AS ENUM (
  'draft',
  'pending',
  'approved',
  'rejected',
  'paid'
);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  role public.user_role NOT NULL DEFAULT 'employee',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_role ON public.profiles (role);

CREATE TABLE public.reimbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  expense_date DATE NOT NULL,
  type TEXT NOT NULL CHECK (
    type IN ('餐饮', '打车', '差旅', '采购', '办公', '其他')
  ),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
  description TEXT,
  status public.reimbursement_status NOT NULL DEFAULT 'draft',
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reimbursements_user ON public.reimbursements (user_id);
CREATE INDEX idx_reimbursements_status ON public.reimbursements (status);

CREATE TABLE public.reimbursement_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reimbursement_id UUID NOT NULL REFERENCES public.reimbursements (id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT,
  content_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (reimbursement_id, storage_path)
);

CREATE INDEX idx_attachments_reimbursement ON public.reimbursement_attachments (reimbursement_id);

CREATE TABLE public.reimbursement_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reimbursement_id UUID NOT NULL REFERENCES public.reimbursements (id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_logs_reimbursement ON public.reimbursement_logs (reimbursement_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER reimbursements_updated_at
  BEFORE UPDATE ON public.reimbursements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    'employee'::public.user_role
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reimbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reimbursement_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reimbursement_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_finance_staff(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = uid AND p.role IN ('finance_admin', 'super_admin')
  );
$$;

CREATE POLICY "profiles_select_own_or_finance"
  ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR public.is_finance_staff(auth.uid())
  );

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "reimb_select_owner_or_finance"
  ON public.reimbursements FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_finance_staff(auth.uid())
  );

CREATE POLICY "reimb_insert_own"
  ON public.reimbursements FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 员工只能改自己的草稿/已驳回；且不能把状态改成已通过/已打款（由财务改）
CREATE POLICY "reimb_update_employee"
  ON public.reimbursements FOR UPDATE
  USING (user_id = auth.uid() AND status IN ('draft', 'rejected'))
  WITH CHECK (
    user_id = auth.uid()
    AND status IN ('draft', 'pending', 'rejected')
  );

CREATE POLICY "reimb_update_finance"
  ON public.reimbursements FOR UPDATE
  USING (public.is_finance_staff(auth.uid()));

CREATE POLICY "reimb_delete_own_draft"
  ON public.reimbursements FOR DELETE
  USING (user_id = auth.uid() AND status = 'draft');

CREATE POLICY "attach_select"
  ON public.reimbursement_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.reimbursements r
      WHERE r.id = reimbursement_id
        AND (r.user_id = auth.uid() OR public.is_finance_staff(auth.uid()))
    )
  );

CREATE POLICY "attach_insert_owner"
  ON public.reimbursement_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reimbursements r
      WHERE r.id = reimbursement_id
        AND r.user_id = auth.uid()
        AND r.status IN ('draft', 'rejected')
    )
  );

CREATE POLICY "attach_delete_owner_editable"
  ON public.reimbursement_attachments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.reimbursements r
      WHERE r.id = reimbursement_id
        AND r.user_id = auth.uid()
        AND r.status IN ('draft', 'rejected')
    )
  );

CREATE POLICY "logs_select"
  ON public.reimbursement_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.reimbursements r
      WHERE r.id = reimbursement_id
        AND (r.user_id = auth.uid() OR public.is_finance_staff(auth.uid()))
    )
  );

CREATE POLICY "logs_insert"
  ON public.reimbursement_logs FOR INSERT
  WITH CHECK (actor_id IS NULL OR actor_id = auth.uid());

INSERT INTO storage.buckets (id, name, public)
VALUES ('reimbursement-files', 'reimbursement-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "storage_upload_own_folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'reimbursement-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "storage_read_own_or_finance"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'reimbursement-files'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_finance_staff(auth.uid())
    )
  );

CREATE POLICY "storage_delete_own_folder"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'reimbursement-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
