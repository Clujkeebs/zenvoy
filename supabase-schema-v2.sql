-- ============================================================
-- ZENVOY v2 — Updated Database Schema
-- Run this AFTER the base schema, or as a fresh install
-- ============================================================

-- ─── Update profiles table with new fields ─────────────
-- If running on existing DB, use ALTER TABLE instead:
-- ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'user';
-- ALTER TABLE profiles ADD COLUMN profile_image_url TEXT;
-- ALTER TABLE profiles ADD COLUMN banned BOOLEAN DEFAULT FALSE;

-- Fresh install: full profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  country TEXT NOT NULL DEFAULT 'United States',
  svc TEXT DEFAULT 'web',
  currency TEXT DEFAULT 'USD',
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free','starter','growth','pro','scale','enterprise')),
  scans_used INTEGER DEFAULT 0,
  bonus_scans INTEGER DEFAULT 0,
  ref_code TEXT UNIQUE,
  referrals INTEGER DEFAULT 0,
  role TEXT DEFAULT 'user' CHECK (role IN ('user','moderator','admin')),
  profile_image_url TEXT,
  banned BOOLEAN DEFAULT FALSE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  trial_end TIMESTAMPTZ,
  trial_started TIMESTAMPTZ,
  onboarded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Reports table (community moderation) ──────────────
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  offender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  offender_name TEXT,
  message_id UUID,
  reason TEXT NOT NULL,
  detail TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','resolved','dismissed')),
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Community posts (updated with moderation fields) ──
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT DEFAULT 'user',
  group_id TEXT,
  content TEXT NOT NULL,
  likes UUID[] DEFAULT '{}',
  flagged BOOLEAN DEFAULT FALSE,
  flag_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Profile image storage ─────────────────────────────
-- In Supabase, create a storage bucket called 'avatars'
-- Dashboard → Storage → New Bucket → name: avatars, public: true
-- Then add this policy:
--   Bucket: avatars
--   Policy: Allow authenticated users to upload to their own folder
--   Definition: (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])

-- ─── Indexes ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_offender ON reports(offender_id);
CREATE INDEX IF NOT EXISTS idx_posts_flagged ON posts(flagged) WHERE flagged = true;
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_banned ON profiles(banned) WHERE banned = true;

-- ─── RLS for reports ───────────────────────────────────
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Anyone can create reports (authenticated)
CREATE POLICY "create reports" ON reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- Admins/mods can read all reports
CREATE POLICY "mods read reports" ON reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'moderator')
    )
  );

-- Admins can update report status
CREATE POLICY "admins resolve reports" ON reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ─── Admin-only: update any user's role/ban status ─────
CREATE POLICY "admins manage users" ON profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles AS admin_check
      WHERE admin_check.id = auth.uid()
      AND admin_check.role = 'admin'
    )
  );

-- ─── Auto-set admin on specific email ──────────────────
-- Update the signup trigger to check for admin email
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, name, country, svc, currency, ref_code, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'country', 'United States'),
    COALESCE(NEW.raw_user_meta_data->>'svc', 'web'),
    COALESCE(NEW.raw_user_meta_data->>'currency', 'USD'),
    'ZV-' || UPPER(LEFT(SPLIT_PART(NEW.email, '@', 1), 4)) || '-' || UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 4)),
    CASE WHEN NEW.email = 'admin@zenvoy.com' THEN 'admin' ELSE 'user' END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── Helper: check if user is mod/admin ────────────────
CREATE OR REPLACE FUNCTION is_mod_or_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND role IN ('admin', 'moderator')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
