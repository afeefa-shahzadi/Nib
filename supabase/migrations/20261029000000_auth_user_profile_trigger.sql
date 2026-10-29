-- handle_new_user() existed but no migration attached it to auth.users, so a
-- database built from migrations (local, CI) created users without profiles.
-- Idempotent (CREATE OR REPLACE TRIGGER, as schema.sql does).
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
