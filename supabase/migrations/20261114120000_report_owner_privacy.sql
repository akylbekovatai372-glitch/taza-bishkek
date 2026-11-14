-- Public map fields must not disclose the report owner's auth UUID.
-- Apply after the existing migrations, using the Supabase SQL editor
-- or the project's normal migration workflow.
BEGIN;

REVOKE SELECT ON TABLE public.reports FROM PUBLIC, anon, authenticated;
REVOKE SELECT (user_id) ON public.reports FROM PUBLIC, anon, authenticated;

GRANT SELECT (
    id, type, description, lat, lng, status,
    photo, photo_after, created_at, cleanup_enabled
) ON TABLE public.reports TO anon, authenticated;

-- get_my_cleanups remains SECURITY INVOKER: it only reads public report
-- columns and its own participation rows, which are protected by RLS.
COMMIT;
