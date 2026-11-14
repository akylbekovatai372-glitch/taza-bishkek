BEGIN;

ALTER FUNCTION public.get_my_reports()
SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.get_my_reports()
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_my_reports()
TO authenticated;

COMMIT;
