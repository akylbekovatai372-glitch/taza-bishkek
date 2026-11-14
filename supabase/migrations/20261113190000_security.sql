-- Taza Bishkek 2.0
-- Security improvements
-- 2026-11-13

BEGIN;

-- 1. Защита создания заявок

ALTER POLICY "Public create reports"
ON public.reports
WITH CHECK (
    status = 'Новая'
    AND photo_after IS NULL
    AND user_id IS NOT DISTINCT FROM (SELECT auth.uid())
);

-- 2. Удаление дублирующей политики

DROP POLICY IF EXISTS "Moderators update reports"
ON public.reports;

-- 3. Ограничение прав модераторов

REVOKE UPDATE ON public.reports
FROM authenticated;

GRANT UPDATE (status, photo_after)
ON public.reports
TO authenticated;

COMMIT;