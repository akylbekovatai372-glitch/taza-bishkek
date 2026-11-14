BEGIN;

CREATE TABLE public.cleanup_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title text NOT NULL,
    description text,
    organizer text NOT NULL,
    event_date timestamptz,
    safety_rules text,
    status text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'reviewed', 'cancelled')),
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cleanup_events
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.cleanup_events
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.cleanup_events
TO authenticated;

CREATE POLICY "Moderators read cleanup events"
ON public.cleanup_events
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.moderators m
        WHERE m.user_id = (SELECT auth.uid())
    )
);

COMMIT;