-- Track whether a user has seen the newsletter modal across devices
ALTER TABLE user_stats 
  ADD COLUMN IF NOT EXISTS has_seen_newsletter_modal BOOLEAN DEFAULT false;
