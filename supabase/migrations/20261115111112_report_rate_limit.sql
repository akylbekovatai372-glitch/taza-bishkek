BEGIN;
CREATE SCHEMA IF NOT EXISTS taza_internal;
REVOKE ALL ON SCHEMA taza_internal FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS reports_owner_created_idx ON public.reports(user_id,created_at);
CREATE FUNCTION taza_internal.guard_report_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE actor uuid := (SELECT auth.uid());
BEGIN
  -- Admin maintenance is independent of visitor sessions.
  IF actor IS NULL THEN RETURN NEW; END IF;
  IF NEW.user_id IS DISTINCT FROM actor THEN RAISE EXCEPTION 'report_owner_mismatch' USING ERRCODE='42501'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text,0));
  IF (SELECT count(*) FROM public.reports WHERE user_id=actor AND created_at>pg_catalog.now()-interval '10 minutes') >= 5 THEN
    RAISE EXCEPTION 'report_rate_limit' USING ERRCODE='P0001';
  END IF;
  NEW.created_at := pg_catalog.clock_timestamp();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION taza_internal.guard_report_insert() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER a_report_submission_guard BEFORE INSERT ON public.reports
FOR EACH ROW EXECUTE FUNCTION taza_internal.guard_report_insert();
REVOKE INSERT ON public.reports FROM PUBLIC, anon, authenticated;
GRANT INSERT(type,description,lat,lng,status,photo,photo_after,user_id,cleanup_enabled) ON public.reports TO authenticated;
ALTER POLICY "Public create reports" ON public.reports TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND user_id=(SELECT auth.uid()) AND status='Новая' AND photo_after IS NULL AND cleanup_enabled=false);
COMMIT;
