-- LABVERSE: Keep PC Lab inventory transactions hidden from College Admin.
-- Align transaction-row access with the inventory_items and transaction RPC rules.

DROP POLICY IF EXISTS "Inventory Transactions Staff Read"
  ON public.inventory_transactions;

CREATE POLICY "Inventory Transactions Staff Read"
  ON public.inventory_transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.inventory_items i
      LEFT JOIN public.labs l
        ON l.id = i.lab_id
       AND l.institution_id = i.institution_id
      WHERE i.id = inventory_transactions.item_id
        AND (
          (
            public.is_college_admin(i.institution_id)
            AND (
              i.lab_id IS NULL
              OR COALESCE(l.lab_type, 'practical') <> 'pc_lab'
            )
          )
          OR (
            NOT public.is_college_admin(i.institution_id)
            AND i.lab_id IS NOT NULL
            AND public.has_lab_access(i.lab_id)
          )
        )
    )
  );

DROP POLICY IF EXISTS "Inventory Transactions Staff Insert"
  ON public.inventory_transactions;

CREATE POLICY "Inventory Transactions Staff Insert"
  ON public.inventory_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.inventory_items i
      LEFT JOIN public.labs l
        ON l.id = i.lab_id
       AND l.institution_id = i.institution_id
      WHERE i.id = inventory_transactions.item_id
        AND (
          (
            public.is_college_admin(i.institution_id)
            AND (
              i.lab_id IS NULL
              OR COALESCE(l.lab_type, 'practical') <> 'pc_lab'
            )
          )
          OR (
            NOT public.is_college_admin(i.institution_id)
            AND i.lab_id IS NOT NULL
            AND public.has_lab_access(i.lab_id)
          )
        )
    )
  );

COMMENT ON POLICY "Inventory Transactions Staff Read"
  ON public.inventory_transactions IS
  'College Admins can view transactions for practical-lab inventory only. Lab Assistants can view transactions for inventory in their assigned laboratories, including PC Lab when assigned.';

COMMENT ON POLICY "Inventory Transactions Staff Insert"
  ON public.inventory_transactions IS
  'College Admins can insert transactions for practical-lab inventory only. Lab Assistants can insert transactions for inventory in their assigned laboratories, including PC Lab when assigned.';
