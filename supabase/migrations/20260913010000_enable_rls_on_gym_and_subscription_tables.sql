-- Fixes ERROR-level Supabase advisor finding: client_subscriptions,
-- gym_profiles, gym_owner_city_access, gym_requirements, and
-- gym_hiring_posts were exposed to PostgREST with RLS entirely disabled,
-- meaning any holder of the public anon key could read/write/delete these
-- rows directly, bypassing the app. All writes to these tables already go
-- through server-side API routes using the service-role key (which bypasses
-- RLS), so enabling RLS here only closes the direct-client-access gap and
-- does not require any INSERT/UPDATE/DELETE policies for anon/authenticated.

-- client_subscriptions: a client reads their own subscription
-- (auth.js:getActiveClientSubscription); admin dashboard reads all.
ALTER TABLE public.client_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view their own subscription"
    ON public.client_subscriptions FOR SELECT
    USING (client_id = auth.uid());

CREATE POLICY "Admins can view all client subscriptions"
    ON public.client_subscriptions FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- gym_profiles: owner manages their own profile (gym-dashboard.html);
-- publicly readable only when the gym has at least one active hiring post
-- (onlifit.html/gym-jobs.html/gym-job-detail.html embed gym_profiles(gym_name)
-- in public job listings); admin sees all.
ALTER TABLE public.gym_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gym owners can view their own profile"
    ON public.gym_profiles FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Gym owners can update their own profile"
    ON public.gym_profiles FOR UPDATE
    USING (owner_id = auth.uid());

CREATE POLICY "Public can view gym profiles with an active hiring post"
    ON public.gym_profiles FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM gym_hiring_posts
        WHERE gym_hiring_posts.gym_profile_id = gym_profiles.id
        AND gym_hiring_posts.status = 'active'
    ));

CREATE POLICY "Admins can view all gym profiles"
    ON public.gym_profiles FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- gym_owner_city_access: owner reads their own unlocked-city records; no
-- current UI reads this directly for anyone else, admin included for
-- consistency with every other table here.
ALTER TABLE public.gym_owner_city_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gym owners can view their own city access"
    ON public.gym_owner_city_access FOR SELECT
    USING (gym_owner_id = auth.uid());

CREATE POLICY "Admins can view all gym owner city access"
    ON public.gym_owner_city_access FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- gym_requirements: not currently read or written anywhere in the app
-- (repo-wide search found zero references) — enable RLS with an owner
-- policy ready for when this table is actually wired up, matching the
-- pattern above rather than leaving it silently unprotected until then.
ALTER TABLE public.gym_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gym owners can view their own requirements"
    ON public.gym_requirements FOR SELECT
    USING (gym_owner_id = auth.uid());

CREATE POLICY "Admins can view all gym requirements"
    ON public.gym_requirements FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- gym_hiring_posts: public can see active listings (job board + detail
-- page), owner sees all their own posts regardless of status (dashboard),
-- admin sees all.
ALTER TABLE public.gym_hiring_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active hiring posts"
    ON public.gym_hiring_posts FOR SELECT
    USING (status = 'active');

CREATE POLICY "Gym owners can view their own hiring posts"
    ON public.gym_hiring_posts FOR SELECT
    USING (gym_owner_id = auth.uid());

CREATE POLICY "Admins can view all hiring posts"
    ON public.gym_hiring_posts FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
