-- Fixes a critical revenue-bypass vulnerability: activate_client_subscription,
-- activate_gym_hiring_post, activate_gym_owner_access, and
-- activate_subscription_payment are SECURITY DEFINER functions that mark a
-- payment 'paid' and grant real subscription/boost/listing access based on
-- whatever razorpay_payment_id and amount the CALLER supplies -- they never
-- verify anything against Razorpay themselves. The Supabase security advisor
-- confirmed these were directly callable by any anonymous or signed-in user
-- via /rest/v1/rpc/<function_name> (granted to PUBLIC by default at function
-- creation, which every role -- including anon and authenticated -- inherits
-- through regardless of any role-specific revoke), meaning anyone could call
-- one with a fabricated payment id and grant themselves a free Elite
-- subscription, free gym hiring post, or free city access, entirely
-- bypassing Razorpay.
--
-- The legitimate flow (api/verify-payment.js) does real HMAC signature
-- verification against RAZORPAY_KEY_SECRET server-side, then calls these
-- RPCs using the service-role key. This revokes EXECUTE from PUBLIC and
-- explicitly re-grants only to service_role, so that path is unaffected --
-- confirmed via has_function_privilege() before and after applying this
-- directly to production.
REVOKE EXECUTE ON FUNCTION public.activate_client_subscription(uuid, text, text, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.activate_gym_hiring_post(uuid, text, text, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.activate_gym_owner_access(uuid, text, text, text, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.activate_subscription_payment(uuid, text, text, text, numeric) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.activate_client_subscription(uuid, text, text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_gym_hiring_post(uuid, text, text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_gym_owner_access(uuid, text, text, text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_subscription_payment(uuid, text, text, text, numeric) TO service_role;
