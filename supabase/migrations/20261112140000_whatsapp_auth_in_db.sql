-- WhatsApp login (Baileys auth keys) stored in the database instead of
-- data/whatsapp/session, so it survives Coolify redeploys.
-- Server-only: RLS on with no policies, so only the service role can touch it.

CREATE TABLE IF NOT EXISTS public.whatsapp_auth (
  key        text PRIMARY KEY,          -- 'creds' or '<type>-<id>'
  value      text NOT NULL,             -- JSON (Baileys BufferJSON encoding)
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_auth ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_auth FROM anon, authenticated;

-- Single-row lease: only the server holding it may connect to WhatsApp.
-- Stops the old and new container both connecting during a redeploy.
CREATE TABLE IF NOT EXISTS public.whatsapp_lease (
  id           smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  owner        text NOT NULL,
  heartbeat_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_lease ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_lease FROM anon, authenticated;

-- Take (or renew) the lease. Succeeds when it is free, already ours, or the
-- holder stopped heart-beating for p_stale_seconds.
CREATE OR REPLACE FUNCTION public.whatsapp_acquire_lease(p_owner text, p_stale_seconds int DEFAULT 30)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  got text;
BEGIN
  INSERT INTO whatsapp_lease AS l (id, owner, heartbeat_at)
  VALUES (1, p_owner, now())
  ON CONFLICT (id) DO UPDATE
    SET owner = EXCLUDED.owner, heartbeat_at = now()
    WHERE l.owner = p_owner
       OR l.heartbeat_at < now() - make_interval(secs => p_stale_seconds)
  RETURNING owner INTO got;
  RETURN got IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_release_lease(p_owner text)
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  DELETE FROM whatsapp_lease WHERE owner = p_owner;
$$;

REVOKE EXECUTE ON FUNCTION public.whatsapp_acquire_lease(text, int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.whatsapp_release_lease(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_acquire_lease(text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_release_lease(text) TO service_role;
