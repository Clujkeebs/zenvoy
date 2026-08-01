-- Remove the AI media bot and its social analytics schemas. Neither was used
-- by Zenvylo. Verified before dropping: no foreign keys crossed into
-- public/auth, no edge function referenced them, and every table was empty
-- except aimediabot.config (6 settings rows).
DROP SCHEMA IF EXISTS aimediabot CASCADE;
DROP SCHEMA IF EXISTS analytics  CASCADE;
