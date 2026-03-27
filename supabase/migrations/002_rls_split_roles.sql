-- 增量：按角色拆分权限（在已执行 001_initial.sql 的库上运行）
-- 1. 财务审核 / 查看全量报销与附件：仅 finance_admin（不含 super_admin）
-- 2. 创建/编辑报销、附件、Storage 上传：仅 employee
-- 3. super_admin：可 SELECT / UPDATE 任意 profiles（用于后台改角色；创建用户仍用 service role）

CREATE OR REPLACE FUNCTION public.is_finance_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = uid AND p.role = 'finance_admin'::public.user_role
  );
$$;

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

CREATE OR REPLACE FUNCTION public.is_employee(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = uid AND p.role = 'employee'::public.user_role
  );
$$;

DROP POLICY IF EXISTS "profiles_select_own_or_finance" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_select_policy"
  ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR public.is_finance_admin(auth.uid())
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_super_admin"
  ON public.profiles FOR UPDATE
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (true);

DROP POLICY IF EXISTS "reimb_select_owner_or_finance" ON public.reimbursements;
DROP POLICY IF EXISTS "reimb_insert_own" ON public.reimbursements;
DROP POLICY IF EXISTS "reimb_update_employee" ON public.reimbursements;
DROP POLICY IF EXISTS "reimb_update_finance" ON public.reimbursements;
DROP POLICY IF EXISTS "reimb_delete_own_draft" ON public.reimbursements;

CREATE POLICY "reimb_select_owner_or_finance"
  ON public.reimbursements FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_finance_admin(auth.uid())
  );

CREATE POLICY "reimb_insert_employee_only"
  ON public.reimbursements FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_employee(auth.uid())
  );

CREATE POLICY "reimb_update_employee"
  ON public.reimbursements FOR UPDATE
  USING (
    user_id = auth.uid()
    AND status IN ('draft', 'rejected')
    AND public.is_employee(auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    AND status IN ('draft', 'pending', 'rejected')
    AND public.is_employee(auth.uid())
  );

CREATE POLICY "reimb_update_finance"
  ON public.reimbursements FOR UPDATE
  USING (public.is_finance_admin(auth.uid()));

CREATE POLICY "reimb_delete_own_draft"
  ON public.reimbursements FOR DELETE
  USING (
    user_id = auth.uid()
    AND status = 'draft'
    AND public.is_employee(auth.uid())
  );

DROP POLICY IF EXISTS "attach_select" ON public.reimbursement_attachments;
DROP POLICY IF EXISTS "attach_insert_owner" ON public.reimbursement_attachments;
DROP POLICY IF EXISTS "attach_delete_owner_editable" ON public.reimbursement_attachments;

CREATE POLICY "attach_select"
  ON public.reimbursement_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.reimbursements r
      WHERE r.id = reimbursement_id
        AND (
          r.user_id = auth.uid()
          OR public.is_finance_admin(auth.uid())
        )
    )
  );

CREATE POLICY "attach_insert_owner"
  ON public.reimbursement_attachments FOR INSERT
  WITH CHECK (
    public.is_employee(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.reimbursements r
      WHERE r.id = reimbursement_id
        AND r.user_id = auth.uid()
        AND r.status IN ('draft', 'rejected')
    )
  );

CREATE POLICY "attach_delete_owner_editable"
  ON public.reimbursement_attachments FOR DELETE
  USING (
    public.is_employee(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.reimbursements r
      WHERE r.id = reimbursement_id
        AND r.user_id = auth.uid()
        AND r.status IN ('draft', 'rejected')
    )
  );

DROP POLICY IF EXISTS "logs_select" ON public.reimbursement_logs;

CREATE POLICY "logs_select"
  ON public.reimbursement_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.reimbursements r
      WHERE r.id = reimbursement_id
        AND (
          r.user_id = auth.uid()
          OR public.is_finance_admin(auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "storage_upload_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "storage_read_own_or_finance" ON storage.objects;
DROP POLICY IF EXISTS "storage_delete_own_folder" ON storage.objects;

CREATE POLICY "storage_upload_own_folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'reimbursement-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.is_employee(auth.uid())
  );

CREATE POLICY "storage_read_own_or_finance"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'reimbursement-files'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_finance_admin(auth.uid())
    )
  );

CREATE POLICY "storage_delete_own_folder"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'reimbursement-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.is_employee(auth.uid())
  );

DROP FUNCTION IF EXISTS public.is_finance_staff(UUID);
