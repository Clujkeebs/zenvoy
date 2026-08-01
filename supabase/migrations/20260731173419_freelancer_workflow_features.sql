-- Outreach tracking: which touch you're on, when you last made contact,
-- and how the deal ended. Feeds the Today queue and the win-rate analysis.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS outreach_step   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outreach_log    JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS lost_reason     TEXT,
  ADD COLUMN IF NOT EXISTS closed_at       TIMESTAMPTZ;

-- Monthly revenue target, so the dashboard can answer "am I on track".
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS monthly_goal INTEGER DEFAULT 0;

-- The user owns this number; it isn't a billing field.
GRANT UPDATE (monthly_goal) ON public.profiles TO authenticated;

CREATE INDEX IF NOT EXISTS idx_leads_contact
  ON public.leads(user_id, last_contact_at DESC)
  WHERE last_contact_at IS NOT NULL;
