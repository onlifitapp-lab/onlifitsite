(function () {
    const ROLE_STORAGE_KEY = 'onlifit_user_role';
    const TRAINER_INTENT_KEY = 'onlifit_trainer_intent';
    const OAUTH_SIGNUP_SOURCE_KEY = 'oauth_signup_source';
    const OAUTH_ROLE_KEY = 'oauth_role';
    const OAUTH_INTENT_KEY = 'oauth_intent';

    function getParam(name) {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    }

    const state = {
        mode: (getParam('tab') || '').toLowerCase() === 'signup' ? 'signup' : 'signin',
        role: (getParam('role') || '').toLowerCase() === 'trainer' ? 'trainer' : 'client',
        source: (getParam('source') || '').toLowerCase(),
        isBusy: false
    };

    function persistTrainerIntent() {
        localStorage.setItem(TRAINER_INTENT_KEY, 'join-us');
        localStorage.setItem(ROLE_STORAGE_KEY, 'trainer');
        localStorage.setItem(OAUTH_SIGNUP_SOURCE_KEY, 'join-us');
        localStorage.setItem(OAUTH_ROLE_KEY, 'trainer');
        localStorage.setItem(OAUTH_INTENT_KEY, 'join_us_trainer_signup');
    }

    function clearTrainerIntent() {
        localStorage.removeItem(TRAINER_INTENT_KEY);
        localStorage.removeItem(ROLE_STORAGE_KEY);
        localStorage.removeItem(OAUTH_SIGNUP_SOURCE_KEY);
        localStorage.removeItem(OAUTH_ROLE_KEY);
        localStorage.removeItem(OAUTH_INTENT_KEY);
    }

    function hasTrainerIntent() {
        return localStorage.getItem(TRAINER_INTENT_KEY) === 'join-us'
            || localStorage.getItem(ROLE_STORAGE_KEY) === 'trainer'
            || localStorage.getItem(OAUTH_SIGNUP_SOURCE_KEY) === 'join-us'
            || localStorage.getItem(OAUTH_ROLE_KEY) === 'trainer'
            || localStorage.getItem(OAUTH_INTENT_KEY) === 'join_us_trainer_signup';
    }

    function isTrainerJoinUsSignupFlow() {
        const explicitJoinUs = state.mode === 'signup' && state.role === 'trainer' && state.source === 'join-us';
        return explicitJoinUs || hasTrainerIntent();
    }

    function setNotice(message, type) {
        const notice = document.getElementById('auth-notice');
        if (!notice) return;

        if (!message) {
            notice.className = 'hidden';
            notice.textContent = '';
            return;
        }

        const variant = type === 'success' ? 'success' : 'error';
        notice.className = `notice ${variant}`;
        notice.textContent = message;
    }

    function setBusy(isBusy) {
        state.isBusy = isBusy;
        const controls = [
            document.getElementById('mode-signin'),
            document.getElementById('mode-signup'),
            document.getElementById('email-submit-btn'),
            document.getElementById('google-auth-btn'),
            document.getElementById('forgot-password-link'),
            document.getElementById('switch-mode-link')
        ].filter(Boolean);

        controls.forEach((el) => {
            el.disabled = isBusy;
            el.style.opacity = isBusy ? '0.6' : '1';
            el.style.cursor = isBusy ? 'not-allowed' : 'pointer';
        });
    }

    function updateModeUi() {
        const signinBtn = document.getElementById('mode-signin');
        const signupBtn = document.getElementById('mode-signup');
        const subtitle = document.getElementById('auth-subtitle');
        const nameWrap = document.getElementById('field-name-wrap');
        const passwordInput = document.getElementById('auth-password');
        const emailSubmitBtn = document.getElementById('email-submit-btn');
        const googleLabel = document.getElementById('google-btn-label');
        const forgotLink = document.getElementById('forgot-password-link');
        const switchLabel = document.getElementById('switch-mode-label');
        const switchLink = document.getElementById('switch-mode-link');

        const isSignup = state.mode === 'signup';

        signinBtn.classList.toggle('active', !isSignup);
        signupBtn.classList.toggle('active', isSignup);

        if (isSignup) {
            subtitle.textContent = 'Create a new account with email or Google.';
            nameWrap.classList.remove('hidden');
            passwordInput.setAttribute('autocomplete', 'new-password');
            emailSubmitBtn.textContent = 'Create account with Email';
            googleLabel.textContent = 'Sign up with Google';
            forgotLink.classList.add('hidden');
            switchLabel.textContent = 'Already have an account?';
            switchLink.textContent = 'Sign in';
        } else {
            subtitle.textContent = 'Sign in to continue your fitness journey.';
            nameWrap.classList.add('hidden');
            passwordInput.setAttribute('autocomplete', 'current-password');
            emailSubmitBtn.textContent = 'Sign in with Email';
            googleLabel.textContent = 'Continue with Google';
            forgotLink.classList.remove('hidden');
            switchLabel.textContent = "Don't have an account?";
            switchLink.textContent = 'Create one';
        }
    }

    function getSafeDashboardHref(role) {
        if (typeof getDashboardPathForRole === 'function') {
            return getDashboardPathForRole(role || 'client');
        }

        if (role === 'trainer') return 'bookings.html';
        if (role === 'admin') return 'admin-dashboard.html';
        return 'client-dashboard.html';
    }

    async function handleEmailAuth(event) {
        event.preventDefault();
        if (state.isBusy) return;

        const isSignup = state.mode === 'signup';
        const name = (document.getElementById('auth-name')?.value || '').trim();
        const email = (document.getElementById('auth-email')?.value || '').trim().toLowerCase();
        const password = document.getElementById('auth-password')?.value || '';

        if (!email || !password) {
            setNotice('Please enter your email and password.', 'error');
            return;
        }

        if (isSignup && !name) {
            setNotice('Please enter your full name to create your account.', 'error');
            return;
        }

        if (password.length < 6) {
            setNotice('Password must be at least 6 characters long.', 'error');
            return;
        }

        setNotice('', 'error');
        setBusy(true);

        try {
            if (isSignup) {
                const signupRole = isTrainerJoinUsSignupFlow() ? 'trainer' : 'client';
                const result = await signUp(name, email, password, signupRole, null, null);
                if (!result?.success) {
                    const errorText = String(result?.error || 'Sign up failed. Please try again.');
                    
                    // Check if error is due to existing account
                    const isExistingAccountError = /already exists|already registered|email.*in use|sign in instead/i.test(errorText);
                    if (isExistingAccountError) {
                        console.log('Detected existing account, switching to signin and attempting login...');
                        setNotice('Account already exists. Signing you in...', 'success');
                        
                        // Switch to signin mode
                        state.mode = 'signin';
                        updateModeUi();
                        
                        // Preserve email and password
                        document.getElementById('auth-email').value = email;
                        document.getElementById('auth-password').value = password;
                        
                        // Automatically attempt login with same credentials
                        await new Promise(resolve => setTimeout(resolve, 600));
                        
                        const loginResult = await login(email, password);
                        if (loginResult?.success) {
                            console.log('Existing account login successful, redirecting...');
                            setNotice('Signed in successfully. Redirecting...', 'success');
                            const strictTrainerIntent = isTrainerJoinUsSignupFlow();
                            let userRole = loginResult?.user?.role || state.role || 'client';

                            if (strictTrainerIntent && userRole !== 'admin') {
                                persistTrainerIntent();

                                if (userRole !== 'trainer' && loginResult?.user?.id && typeof updateUserProfile === 'function') {
                                    const promote = await updateUserProfile(loginResult.user.id, { role: 'trainer' });
                                    if (promote?.success) {
                                        userRole = 'trainer';
                                    }
                                }

                                const verificationStatusStrict = String(loginResult?.user?.verification_status || '').toLowerCase();
                                const approvedStrict = verificationStatusStrict === 'approved' || verificationStatusStrict === 'verified';
                                const onboardingDoneStrict = !!loginResult?.user?.onboarding_completed;

                                if (!onboardingDoneStrict || !approvedStrict) {
                                    window.location.href = 'trainer-onboarding.html?role=trainer&source=join-us';
                                    return;
                                }

                                window.location.href = getSafeDashboardHref('trainer');
                                return;
                            }

                            const verificationStatus = String(loginResult?.user?.verification_status || '').toLowerCase();
                            if (userRole === 'trainer' && verificationStatus && verificationStatus !== 'approved' && verificationStatus !== 'verified') {
                                window.location.href = 'trainer-onboarding.html';
                                return;
                            }
                            window.location.href = getSafeDashboardHref(userRole);
                            return;
                        } else {
                            console.error('Existing account login failed:', loginResult?.error);
                            setNotice('Account exists but sign-in failed. Please verify your password.', 'error');
                            return;
                        }
                    }
                    
                    setNotice(errorText, 'error');
                    return;
                }

                if (signupRole === 'trainer') {
                    persistTrainerIntent();
                    setNotice('Trainer account created. Setting up your profile...', 'success');
                    const sb = window.supabaseClient || window.supabase;
                    let trainerRoleConfirmed = false;
                    
                    // CRITICAL: Ensure trainer role is persisted before redirecting
                    // New signups may have role not yet synced, so verify and update if needed
                    const createdUserId = result?.user?.id;
                    if (createdUserId && sb) {
                        try {
                            // Fetch the profile to confirm role
                            const { data: profileCheck, error: profileCheckError } = await sb
                                .from('profiles')
                                .select('id, role')
                                .eq('id', createdUserId)
                                .limit(1);

                            if (profileCheckError) {
                                throw profileCheckError;
                            }
                            
                            if (profileCheck && Array.isArray(profileCheck) && profileCheck.length > 0) {
                                const currentRole = profileCheck[0]?.role;
                                console.log('Trainer profile role check:', currentRole);
                                
                                // If role is not trainer, update it
                                if (currentRole !== 'trainer') {
                                    console.log('Updating profile role to trainer...');
                                    const { error: promoteError } = await sb
                                        .from('profiles')
                                        .update({ role: 'trainer' })
                                        .eq('id', createdUserId);

                                    if (promoteError) {
                                        throw promoteError;
                                    }
                                }
                            } else {
                                console.log('No profile row found yet, creating trainer profile fallback...');
                                const { error: upsertError } = await sb.from('profiles').upsert({
                                    id: createdUserId,
                                    email,
                                    name,
                                    role: 'trainer',
                                    phone: null
                                }, { onConflict: 'id' });

                                if (upsertError) {
                                    throw upsertError;
                                }
                            }

                            const { data: finalProfileRows, error: finalProfileError } = await sb
                                .from('profiles')
                                .select('role')
                                .eq('id', createdUserId)
                                .limit(1);

                            if (finalProfileError) {
                                throw finalProfileError;
                            }

                            trainerRoleConfirmed = Array.isArray(finalProfileRows)
                                && finalProfileRows.length > 0
                                && finalProfileRows[0]?.role === 'trainer';
                        } catch (e) {
                            console.warn('Profile role verification warning:', e?.message);
                            // Continue anyway - trainer-onboarding page will enforce it
                        }
                    }

                    if (!trainerRoleConfirmed) {
                        setNotice('Trainer role could not be confirmed in database. Please run COMPLETE_RLS_FIX.sql and try again.', 'error');
                        return;
                    }
                    
                    // Wait a bit more to ensure DB sync
                    await new Promise(resolve => setTimeout(resolve, 800));
                    
                    console.log('Trainer signup complete, redirecting to onboarding...');
                    window.location.href = 'trainer-onboarding.html?role=trainer&source=join-us';
                    return;
                }

                setNotice('Account created successfully. Redirecting to setup...', 'success');
                window.location.href = 'onboarding.html';
                return;
            }

            const result = await login(email, password);
            if (!result?.success) {
                setNotice(result?.error || 'Sign in failed. Please check your credentials.', 'error');
                return;
            }

            const strictTrainerIntent = isTrainerJoinUsSignupFlow();
            let userRole = result?.user?.role || state.role || 'client';

            if (strictTrainerIntent && userRole !== 'admin') {
                persistTrainerIntent();

                if (userRole !== 'trainer' && result?.user?.id && typeof updateUserProfile === 'function') {
                    const promote = await updateUserProfile(result.user.id, { role: 'trainer' });
                    if (promote?.success) {
                        userRole = 'trainer';
                    }
                }

                const verificationStatusStrict = String(result?.user?.verification_status || '').toLowerCase();
                const approvedStrict = verificationStatusStrict === 'approved' || verificationStatusStrict === 'verified';
                const onboardingDoneStrict = !!result?.user?.onboarding_completed;

                if (!onboardingDoneStrict || !approvedStrict) {
                    window.location.href = 'trainer-onboarding.html?role=trainer&source=join-us';
                    return;
                }

                window.location.href = getSafeDashboardHref('trainer');
                return;
            }

            const verificationStatus = String(result?.user?.verification_status || '').toLowerCase();
            if (userRole === 'trainer' && verificationStatus && verificationStatus !== 'approved' && verificationStatus !== 'verified') {
                window.location.href = 'trainer-onboarding.html';
                return;
            }
            window.location.href = getSafeDashboardHref(userRole);
        } finally {
            setBusy(false);
        }
    }

    async function handleGoogleAuth() {
        if (state.isBusy) return;

        setNotice('', 'error');
        setBusy(true);

        try {
            const isSignup = state.mode === 'signup';
            const strictTrainerIntent = isTrainerJoinUsSignupFlow();
            // If user is in Join Us trainer flow, always carry trainer-signup intent into OAuth.
            // Without this, fresh Google users can be created as client and then fail trainer onboarding guard.
            const forceTrainerJoinUsOAuthSignup = strictTrainerIntent && state.source === 'join-us';
            const effectiveIsSignup = forceTrainerJoinUsOAuthSignup ? true : isSignup;
            const isTrainerSignup = effectiveIsSignup && strictTrainerIntent;
            const targetRole = effectiveIsSignup
                ? (isTrainerSignup ? 'trainer' : 'client')
                : (strictTrainerIntent ? 'trainer' : state.role);
            const options = effectiveIsSignup
                ? { signupSource: isTrainerSignup ? 'join-us' : 'public' }
                : { signupSource: strictTrainerIntent ? 'join-us' : (state.source || 'direct') };

            if (strictTrainerIntent) {
                persistTrainerIntent();
            }

            const result = await signInWithGoogle(targetRole, effectiveIsSignup, options);
            if (result && result.success === false) {
                setNotice(result.error || 'Google authentication failed. Please try again.', 'error');
            }
        } finally {
            setBusy(false);
        }
    }

    async function handleForgotPassword() {
        if (state.isBusy) return;

        const email = (document.getElementById('auth-email')?.value || '').trim().toLowerCase();
        if (!email) {
            setNotice('Enter your email first, then click Forgot password.', 'error');
            return;
        }

        setNotice('', 'error');
        setBusy(true);

        try {
            const isHttp = window.location.protocol === 'http:' || window.location.protocol === 'https:';
            const redirectBase = isHttp ? window.location.origin : 'https://onlifit.in';
            const redirectTo = `${redirectBase}/login.html`;

            const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
            if (error) {
                setNotice(error.message || 'Unable to send reset link right now.', 'error');
                return;
            }

            setNotice('Password reset link sent. Please check your inbox.', 'success');
        } finally {
            setBusy(false);
        }
    }

    function setupEvents() {
        document.getElementById('mode-signin')?.addEventListener('click', () => {
            state.mode = 'signin';
            setNotice('', 'error');
            updateModeUi();
        });

        document.getElementById('mode-signup')?.addEventListener('click', () => {
            state.mode = 'signup';
            setNotice('', 'error');
            updateModeUi();
        });

        document.getElementById('switch-mode-link')?.addEventListener('click', () => {
            state.mode = state.mode === 'signin' ? 'signup' : 'signin';
            setNotice('', 'error');
            updateModeUi();
        });

        document.getElementById('email-auth-form')?.addEventListener('submit', handleEmailAuth);
        document.getElementById('google-auth-btn')?.addEventListener('click', handleGoogleAuth);
        document.getElementById('forgot-password-link')?.addEventListener('click', handleForgotPassword);
    }

    function init() {
        // If user reached login from Join Us trainer CTA, persist strict trainer flow intent.
        if (state.role === 'trainer' && state.source === 'join-us') {
            persistTrainerIntent();
        } else if (hasTrainerIntent() && state.source === 'join-us') {
            state.role = 'trainer';
            state.source = 'join-us';
        } else {
            // Homepage/default auth flow should remain client-first.
            clearTrainerIntent();
            state.role = 'client';
        }

        setupEvents();
        updateModeUi();

        if (state.role === 'trainer' && state.source === 'join-us' && state.mode === 'signup') {
            setNotice('Complete signup to start your trainer application.', 'success');
            return;
        }

        if (state.role === 'trainer' && state.source !== 'join-us') {
            setNotice('Trainer signup is available only from Join Us. Sign in if you already have an account.', 'error');
        }
    }

    window.addEventListener('DOMContentLoaded', init);
})();
