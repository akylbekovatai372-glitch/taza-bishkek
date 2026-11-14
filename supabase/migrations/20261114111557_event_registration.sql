-- Incremental migration for the existing Taza Bishkek database.
-- Requires cleanup_events from the previously applied baseline migrations.
BEGIN;
ALTER TABLE public.cleanup_events
  ADD COLUMN location text,
  ADD COLUMN registration_open boolean NOT NULL DEFAULT false;
ALTER TABLE public.cleanup_events ADD CONSTRAINT published_event_details CHECK (
  status <> 'reviewed' OR (
    event_date IS NOT NULL AND length(btrim(title)) >= 3
    AND length(btrim(organizer)) > 0
    AND location IS NOT NULL AND length(btrim(location)) > 0
    AND safety_rules IS NOT NULL AND length(btrim(safety_rules)) >= 10
  )
);
ALTER TABLE public.cleanup_events ADD CONSTRAINT registration_requires_publication
  CHECK (NOT registration_open OR status = 'reviewed');

GRANT SELECT ON public.cleanup_events TO anon, authenticated;
GRANT INSERT (title,description,organizer,event_date,safety_rules,status,location,registration_open),
      UPDATE (title,description,organizer,event_date,safety_rules,status,location,registration_open)
ON public.cleanup_events TO authenticated;
DO $$ BEGIN
  EXECUTE format('GRANT USAGE ON SEQUENCE %s TO authenticated', pg_get_serial_sequence('public.cleanup_events','id'));
END $$;
CREATE POLICY "Public read published events" ON public.cleanup_events
FOR SELECT TO anon, authenticated USING (status IN ('reviewed','cancelled'));
CREATE POLICY "Moderators create events" ON public.cleanup_events
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.moderators m WHERE m.user_id = (SELECT auth.uid()))
);
CREATE POLICY "Moderators update events" ON public.cleanup_events
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.moderators m WHERE m.user_id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.moderators m WHERE m.user_id = (SELECT auth.uid())));

CREATE TABLE public.event_participants (
 event_id bigint NOT NULL REFERENCES public.cleanup_events(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (event_id,user_id)
);
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_participants FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.event_participants TO authenticated;
GRANT INSERT (event_id,user_id) ON public.event_participants TO authenticated;
CREATE INDEX event_participants_user_id_idx ON public.event_participants(user_id);
CREATE POLICY "Read own event registration" ON public.event_participants
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Cancel own event registration" ON public.event_participants
FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Register for open event" ON public.event_participants
FOR INSERT TO authenticated WITH CHECK (
 user_id = (SELECT auth.uid())
 AND NOT coalesce(((SELECT auth.jwt()) ->> 'is_anonymous')::boolean,true)
 AND EXISTS (
   SELECT 1 FROM public.cleanup_events e WHERE e.id=event_id
   AND e.status='reviewed' AND e.registration_open AND e.event_date > now()
 )
);
COMMIT;
