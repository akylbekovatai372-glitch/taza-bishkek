-- Taza Bishkek 2.0
-- Volunteer system
-- 2026-11-13

BEGIN;

-- 1. Таблица участников уборок

CREATE TABLE public.report_helpers (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id bigint NOT NULL
        REFERENCES public.reports(id) ON DELETE CASCADE,
    user_id uuid NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (report_id, user_id)
);

-- 2. Безопасность таблицы

ALTER TABLE public.report_helpers
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.report_helpers
FROM PUBLIC, anon, authenticated;

GRANT SELECT, DELETE
ON public.report_helpers
TO authenticated;

GRANT INSERT (report_id, user_id)
ON public.report_helpers
TO authenticated;

-- 3. Политики RLS

CREATE POLICY "Read own participation"
ON public.report_helpers
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Join cleanup"
ON public.report_helpers
FOR INSERT TO authenticated
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
        AND r.status IN ('Проверена', 'В работе')
    )
);

CREATE POLICY "Leave cleanup"
ON public.report_helpers
FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

-- 4. Присоединение к уборке

CREATE OR REPLACE FUNCTION public.join_cleanup(
    p_report_id bigint
)
RETURNS void
LANGUAGE sql
SET search_path = ''
AS $$
    INSERT INTO public.report_helpers (
        report_id,
        user_id
    )
    VALUES (
        p_report_id,
        (SELECT auth.uid())
    )
    ON CONFLICT (report_id, user_id)
    DO NOTHING;
$$;

-- 5. Отказ от участия

CREATE OR REPLACE FUNCTION public.leave_cleanup(
    p_report_id bigint
)
RETURNS void
LANGUAGE sql
SET search_path = ''
AS $$
    DELETE FROM public.report_helpers
    WHERE report_id = p_report_id
    AND user_id = (SELECT auth.uid());
$$;

-- 6. Счётчик волонтёров

CREATE OR REPLACE FUNCTION public.get_helpers_count(
    p_report_id bigint
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT COUNT(*)
    FROM public.report_helpers
    WHERE report_id = p_report_id;
$$;

-- 7. Мои уборки

CREATE OR REPLACE FUNCTION public.get_my_cleanups()
RETURNS TABLE (
    id bigint,
    created_at timestamptz,
    type text,
    description text,
    status text,
    photo text,
    photo_after text
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    SELECT
        r.id,
        r.created_at,
        r.type,
        r.description,
        r.status,
        r.photo,
        r.photo_after
    FROM public.report_helpers h
    JOIN public.reports r
        ON r.id = h.report_id
    WHERE h.user_id = (SELECT auth.uid())
    ORDER BY h.created_at DESC;
$$;

-- 8. Права доступа к функциям

REVOKE ALL ON FUNCTION public.join_cleanup(bigint)
FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.leave_cleanup(bigint)
FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.get_my_cleanups()
FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.get_helpers_count(bigint)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.join_cleanup(bigint)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.leave_cleanup(bigint)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_my_cleanups()
TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_helpers_count(bigint)
TO anon, authenticated;

COMMIT;