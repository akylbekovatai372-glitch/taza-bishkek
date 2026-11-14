BEGIN;

ALTER TABLE public.reports
ADD COLUMN cleanup_enabled boolean
NOT NULL DEFAULT false;

GRANT UPDATE (cleanup_enabled)
ON public.reports
TO authenticated;

ALTER POLICY "Public create reports"
ON public.reports
WITH CHECK (
    status = 'Новая'
    AND photo_after IS NULL
    AND cleanup_enabled = false
    AND user_id IS NOT DISTINCT FROM (SELECT auth.uid())
);

ALTER POLICY "Join cleanup"
ON public.report_helpers
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND NOT COALESCE(
        (auth.jwt() ->> 'is_anonymous')::boolean,
        false
    )
    AND EXISTS (
        SELECT 1
        FROM public.reports r
        WHERE r.id = report_id
        AND r.cleanup_enabled = true
        AND r.status IN ('Проверена', 'В работе')
    )
);

COMMIT;