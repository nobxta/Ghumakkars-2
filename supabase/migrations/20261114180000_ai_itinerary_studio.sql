-- AI Itinerary Studio (admin → AI Itinerary Studio).
-- Projects hold a structured trip-details state (the source of truth for
-- generation), the current itinerary JSON and theme. Every AI request is logged
-- in ai_usage_events with the token counts the provider actually returned.
-- PDFs and reference files live in the private "ai-itineraries" storage bucket
-- and are only served through admin API routes.
-- All writes go through the service role (server routes); admins can read.

CREATE TABLE IF NOT EXISTS ai_itinerary_projects (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title              text NOT NULL DEFAULT 'Untitled itinerary',
  destination        text,
  duration_label     text,
  status             text NOT NULL DEFAULT 'new'
                     CHECK (status IN ('new','collecting','clarifying','ready','generating','pdf_ready','editing','failed')),
  trip_details       jsonb NOT NULL DEFAULT '{}'::jsonb,
  locked_fields      text[] NOT NULL DEFAULT '{}',
  missing_fields     jsonb NOT NULL DEFAULT '[]'::jsonb,
  context_summary    text,
  itinerary          jsonb,
  itinerary_dirty    boolean NOT NULL DEFAULT false,   -- manual edits not yet rendered
  theme              text NOT NULL DEFAULT 'signature',
  theme_options      jsonb NOT NULL DEFAULT '{}'::jsonb,
  model              text,
  current_version_id uuid,
  is_final           boolean NOT NULL DEFAULT false,
  last_error         text,
  weighted_tokens    numeric(14,2) NOT NULL DEFAULT 0,
  raw_tokens         bigint NOT NULL DEFAULT 0,
  archived_at        timestamptz,
  created_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aip_updated ON ai_itinerary_projects(updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_itinerary_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES ai_itinerary_projects(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('user','assistant','system')),
  content     text NOT NULL DEFAULT '',
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_id   text,                                   -- idempotency key from the browser
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aim_project ON ai_itinerary_messages(project_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_aim_client ON ai_itinerary_messages(project_id, client_id) WHERE client_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ai_itinerary_references (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES ai_itinerary_projects(id) ON DELETE CASCADE,
  filename        text NOT NULL,
  mime_type       text NOT NULL,
  size_bytes      integer NOT NULL,
  storage_path    text NOT NULL,
  purpose         text NOT NULL DEFAULT 'auto'
                  CHECK (purpose IN ('auto','extract','structure','design','compare','rewrite','terms','new_from_old')),
  status          text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','ready','failed')),
  extracted_text  text,
  page_count      integer,
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_air_project ON ai_itinerary_references(project_id, created_at);

CREATE TABLE IF NOT EXISTS ai_itinerary_versions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid NOT NULL REFERENCES ai_itinerary_projects(id) ON DELETE CASCADE,
  version_no     integer NOT NULL,
  source         text NOT NULL CHECK (source IN ('generate','edit','theme','manual','restore','snapshot','rerender')),
  label          text,
  itinerary      jsonb NOT NULL,
  theme          text NOT NULL,
  theme_options  jsonb NOT NULL DEFAULT '{}'::jsonb,
  pdf_path       text,
  pdf_size       integer,
  page_count     integer,
  model          text,
  is_final       boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, version_no)
);
CREATE INDEX IF NOT EXISTS idx_aiv_project ON ai_itinerary_versions(project_id, version_no DESC);

CREATE TABLE IF NOT EXISTS ai_generation_jobs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES ai_itinerary_projects(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('chat','generate','edit','render','restore')),
  status       text NOT NULL DEFAULT 'running' CHECK (status IN ('running','succeeded','failed')),
  stage        text,
  error        text,
  started_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz
);
-- At most one running job per project: blocks duplicate paid requests.
CREATE UNIQUE INDEX IF NOT EXISTS uq_aij_running ON ai_generation_jobs(project_id) WHERE status = 'running';
CREATE INDEX IF NOT EXISTS idx_aij_project ON ai_generation_jobs(project_id, started_at DESC);

CREATE TABLE IF NOT EXISTS ai_usage_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid REFERENCES ai_itinerary_projects(id) ON DELETE SET NULL,
  job_id          uuid,
  kind            text NOT NULL,                     -- chat | generate | edit | repair | test | discovery
  model_key       text,                              -- our config key
  model_id        text NOT NULL,                     -- the id sent to the provider
  success         boolean NOT NULL,
  usage_reported  boolean NOT NULL DEFAULT false,    -- false → token columns are NULL (unknown)
  input_tokens    integer,
  output_tokens   integer,
  cached_tokens   integer,                           -- NULL when the provider doesn't report it
  total_tokens    integer,
  multiplier      numeric(8,3),
  priority        boolean NOT NULL DEFAULT false,
  weighted_tokens numeric(14,2),                     -- locally calculated
  latency_ms      integer,
  http_status     integer,
  error_code      text,
  error_message   text,
  attempts        integer NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aiu_created ON ai_usage_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aiu_project ON ai_usage_events(project_id);

CREATE TABLE IF NOT EXISTS ai_itinerary_templates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  description    text,
  theme          text NOT NULL,
  theme_options  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_itinerary_settings (
  id          int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  settings    jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
INSERT INTO ai_itinerary_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- RLS: admins read; all writes go through the service role in API routes.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ai_itinerary_projects','ai_itinerary_messages','ai_itinerary_references',
                           'ai_itinerary_versions','ai_generation_jobs','ai_usage_events',
                           'ai_itinerary_templates','ai_itinerary_settings']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_admin_read', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = ''admin''))',
      t || '_admin_read', t);
  END LOOP;
END $$;

-- Private bucket for generated PDFs and uploaded reference files.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ai-itineraries', 'ai-itineraries', false, 26214400,
        ARRAY['application/pdf','text/plain','text/markdown'])
ON CONFLICT (id) DO NOTHING;
