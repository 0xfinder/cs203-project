-- Ensure the users role check allows MODERATOR and ADMIN values.
-- This migration makes the role constraint accept the full set of application roles.

ALTER TABLE IF EXISTS public.users
    DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('LEARNER', 'CONTRIBUTOR', 'MODERATOR', 'ADMIN'));
