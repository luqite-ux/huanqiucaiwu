-- 扩展报销「类型」枚举；super_admin 可 UPDATE 报销（与 finance 并列策略）并查看他人附件/存储对象（与财务一致）

ALTER TABLE public.reimbursements
  DROP CONSTRAINT IF EXISTS reimbursements_type_check;

ALTER TABLE public.reimbursements
  ADD CONSTRAINT reimbursements_type_check CHECK (
    type IN (
      '软件',
      '餐饮',
      '打车',
      '差旅',
      '采购',
      '办公',
      '通讯网络',
      '快递物流',
      '会务培训',
      '团队建设',
      '物业水电',
      '业务招待',
      '其他'
    )
  );

DROP POLICY IF EXISTS "reimb_update_super_admin" ON public.reimbursements;

CREATE POLICY "reimb_update_super_admin"
  ON public.reimbursements FOR UPDATE
  USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "attach_select" ON public.reimbursement_attachments;

CREATE POLICY "attach_select"
  ON public.reimbursement_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.reimbursements r
      WHERE r.id = reimbursement_id
        AND (
          r.user_id = auth.uid()
          OR public.is_finance_admin(auth.uid())
          OR public.is_super_admin(auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "storage_read_own_or_finance" ON storage.objects;

CREATE POLICY "storage_read_own_or_finance"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'reimbursement-files'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_finance_admin(auth.uid())
      OR public.is_super_admin(auth.uid())
    )
  );
