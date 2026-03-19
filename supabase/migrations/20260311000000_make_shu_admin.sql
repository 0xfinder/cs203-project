-- Set test user Shu to ADMIN for local testing
BEGIN;

-- Update by email; fallback to matching display name if present
UPDATE public.users
SET role = 'ADMIN', updated_at = now()
WHERE email = 'shubhangiskps@gmail.com' OR coalesce(display_name, '') = 'Shu';

COMMIT;
