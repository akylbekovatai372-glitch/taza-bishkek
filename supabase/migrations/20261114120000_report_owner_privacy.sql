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

-- This function already limits rows to auth.uid(). A definer is needed
-- because callers no longer have SELECT access to reports.user_id.
-- Fully qualified relations and the empty search path prevent shadowing.
ALTER FUNCTION public.get_my_cleanups() SECURITY DEFINER;
ALTER FUNCTION public.get_my_cleanups() SET search_path = '';

COMMIT;
