-- 员工在「待审核」下可修改内容并再提交；super_admin 可删除任意报销单及桶内对应文件

DROP POLICY IF EXISTS "reimb_update_employee" ON public.reimbursements;
CREATE POLICY "reimb_update_employee"
  ON public.reimbursements FOR UPDATE
  USING (
    user_id = auth.uid()
    AND status IN ('draft', 'pending', 'rejected')
    AND public.is_employee(auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    AND status IN ('draft', 'pending', 'rejected')
    AND public.is_employee(auth.uid())
  );

DROP POLICY IF EXISTS "attach_insert_owner" ON public.reimbursement_attachments;
CREATE POLICY "attach_insert_owner"
  ON public.reimbursement_attachments FOR INSERT
  WITH CHECK (
    public.is_employee(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.reimbursements r
      WHERE r.id = reimbursement_id
        AND r.user_id = auth.uid()
        AND r.status IN ('draft', 'pending', 'rejected')
    )
  );

DROP POLICY IF EXISTS "attach_delete_owner_editable" ON public.reimbursement_attachments;
CREATE POLICY "attach_delete_owner_editable"
  ON public.reimbursement_attachments FOR DELETE
  USING (
    public.is_employee(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.reimbursements r
      WHERE r.id = reimbursement_id
        AND r.user_id = auth.uid()
        AND r.status IN ('draft', 'pending', 'rejected')
    )
  );

DROP POLICY IF EXISTS "reimb_delete_super_admin" ON public.reimbursements;
CREATE POLICY "reimb_delete_super_admin"
  ON public.reimbursements FOR DELETE
  USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "storage_delete_super_admin" ON storage.objects;
CREATE POLICY "storage_delete_super_admin"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'reimbursement-files'
    AND public.is_super_admin(auth.uid())
  );
