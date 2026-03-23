-- ============================================================
-- ZENVOY v3.2 — Complete Database Schema
-- Paste this entire file into Supabase → SQL Editor → Run
-- ============================================================

-- ─── 1. PROFILES ───────────────────────────────────────
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

-- ─── 2. LEADS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  btype TEXT,
  address TEXT,
  phone TEXT,
  website TEXT,
  rating NUMERIC(3,1),
  reviews INTEGER,
  speed INTEGER,
  ssl BOOLEAN DEFAULT FALSE,
  employees TEXT,
  founded INTEGER,
  problems TEXT[],
  why TEXT,
  score INTEGER,
  suggested_monthly_rate INTEGER,
  my_monthly_rate INTEGER,
  tools_cost_monthly INTEGER,
  setup_cost INTEGER,
  demand_score INTEGER,
  competition_score INTEGER,
  difficulty_rating TEXT,
  market_saturation TEXT,
  country TEXT,
  city TEXT,
  service_id TEXT,
  service_label TEXT,
  status TEXT DEFAULT 'new',
  saved BOOLEAN DEFAULT FALSE,
  notes TEXT DEFAULT '',
  follow_up_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 3. CLIENTS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  btype TEXT,
  monthly_rate INTEGER,
  status TEXT DEFAULT 'active',
  notes TEXT DEFAULT '',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 4. SCANS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  service TEXT NOT NULL,
  country TEXT NOT NULL,
  city TEXT,
  lead_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 5. GLOBAL LEAD NAMES ──────────────────────────────
CREATE TABLE IF NOT EXISTS global_lead_names (
  id BIGSERIAL PRIMARY KEY,
  name_lower TEXT UNIQUE NOT NULL,
  claimed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 6. COMMUNITY GROUPS ───────────────────────────────
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  owner_id TEXT,
  owner_name TEXT,
  member_count INTEGER DEFAULT 0,
  private BOOLEAN DEFAULT FALSE,
  color TEXT DEFAULT 'var(--blue)',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 7. USER ↔ GROUP MEMBERSHIP ────────────────────────
CREATE TABLE IF NOT EXISTS user_groups (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, group_id)
);

-- ─── 8. COMMUNITY POSTS ────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  user_name TEXT,
  user_role TEXT DEFAULT 'user',
  author_name TEXT,
  author_email TEXT,
  author_plan TEXT,
  type TEXT DEFAULT 'general',
  title TEXT,
  group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  upvotes TEXT[] DEFAULT '{}',
  comments JSONB DEFAULT '[]',
  country TEXT,
  service TEXT,
  flagged BOOLEAN DEFAULT FALSE,
  flag_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 9. REPORTS ────────────────────────────────────────
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

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_leads_user ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(user_id, status);
CREATE INDEX IF NOT EXISTS idx_clients_user ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_user ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_global_names ON global_lead_names(name_lower);
CREATE INDEX IF NOT EXISTS idx_posts_group ON posts(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_main ON posts(created_at DESC) WHERE group_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_groups_user ON user_groups(user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_lead_names ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "admins read all profiles" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','moderator'))
);
CREATE POLICY "admins update any profile" ON profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Leads, Clients, Scans: own data only
CREATE POLICY "manage own leads" ON leads FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "manage own clients" ON clients FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "manage own scans" ON scans FOR ALL USING (auth.uid() = user_id);

-- Global names: anyone reads, authenticated writes
CREATE POLICY "read global names" ON global_lead_names FOR SELECT USING (true);
CREATE POLICY "insert global names" ON global_lead_names FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Posts: anyone reads, owners write
CREATE POLICY "read all posts" ON posts FOR SELECT USING (true);
CREATE POLICY "create own posts" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own posts" ON posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "mods update posts" ON posts FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','moderator'))
);

-- Groups: anyone reads, authenticated creates
CREATE POLICY "read all groups" ON groups FOR SELECT USING (true);
CREATE POLICY "create groups" ON groups FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "update own groups" ON groups FOR UPDATE USING (true);

-- User groups: own memberships
CREATE POLICY "manage own memberships" ON user_groups FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "read memberships" ON user_groups FOR SELECT USING (true);

-- Reports
CREATE POLICY "create reports" ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "mods read reports" ON reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','moderator'))
);
CREATE POLICY "admins resolve reports" ON reports FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, name, country, svc, currency, ref_code, role, plan)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'country', 'United States'),
    COALESCE(NEW.raw_user_meta_data->>'svc', 'web'),
    COALESCE(NEW.raw_user_meta_data->>'currency', 'USD'),
    'ZV-' || UPPER(LEFT(SPLIT_PART(NEW.email, '@', 1), 4)) || '-' || UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 4)),
    CASE WHEN NEW.email = 'admin@zenvoy.com' THEN 'admin' ELSE 'user' END,
    'free'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION increment_scans(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles SET scans_used = scans_used + 1 WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- SEED COMMUNITY GROUPS (run once)
-- ============================================================
INSERT INTO groups (id, name, description, owner_id, owner_name, member_count, private, color) VALUES
  ('sg1',  'UK & Ireland Freelancers',     'Leads, wins, and local tips for freelancers across the UK and Ireland', 'system', 'Zenvoy', 0, false, 'var(--blue)'),
  ('sg2',  'SEO Agency Owners',             'Strategy, tools, and lead-sharing for SEO specialists', 'system', 'Zenvoy', 0, false, 'var(--green)'),
  ('sg3',  'Web Designers Network',         'Share web design leads, templates, pricing strategies', 'system', 'Zenvoy', 0, false, 'var(--lime)'),
  ('sg4',  'Cold Email & Outreach Lab',     'Templates, deliverability tips, and reply-rate experiments', 'system', 'Zenvoy', 0, false, 'var(--amber)'),
  ('sg5',  'North America Hustlers',        'US and Canada freelancers sharing leads and rates', 'system', 'Zenvoy', 0, false, 'var(--red)'),
  ('sg6',  'Africa & Middle East Network',  'West Africa, East Africa, UAE, Saudi — connect and find clients', 'system', 'Zenvoy', 0, false, 'var(--teal)'),
  ('sg7',  'Social Media Agency Owners',    'Growing a social media management agency? Share wins here', 'system', 'Zenvoy', 0, false, 'var(--purple)'),
  ('sg8',  'Google Ads & PPC Club',         'Running paid ads for clients? Compare results and rates', 'system', 'Zenvoy', 0, false, 'var(--blue)'),
  ('sg9',  'Asia-Pacific Freelancers',      'Philippines, Australia, India, Singapore — AP market insights', 'system', 'Zenvoy', 0, false, 'var(--green)'),
  ('sg10', 'First $1k/Month Club',          'Working towards your first $1k MRR? Accountability group', 'system', 'Zenvoy', 0, false, 'var(--amber)')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STORAGE: Create an 'avatars' bucket (do this in Supabase Dashboard)
-- Dashboard → Storage → New Bucket → name: avatars → Public: ON
-- ============================================================
