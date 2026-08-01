-- Track the billing period so scan allowances reset when the period actually
-- rolls over, not on every subscription change. Without this, any incidental
-- update (a card change, an address edit) hands the customer a fresh month of
-- scans.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
