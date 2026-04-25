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
                    setNotice(result?.error || 'Sign up failed. Please try again.', 'error');
                    return;
                }

                if (signupRole === 'trainer') {
                    persistTrainerIntent();
                    setNotice('Trainer account created. Redirecting to trainer application...', 'success');
                    window.location.href = 'trainer-onboarding.html?role=trainer&source=join-us';
                    return;
                }

                setNotice('Account created successfully. You can now sign in.', 'success');
                state.mode = 'signin';
                updateModeUi();
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
            const isTrainerSignup = isSignup && strictTrainerIntent;
            const targetRole = isSignup ? (isTrainerSignup ? 'trainer' : 'client') : (strictTrainerIntent ? 'trainer' : state.role);
            const options = isSignup
                ? { signupSource: isTrainerSignup ? 'join-us' : 'public' }
                : { signupSource: strictTrainerIntent ? 'join-us' : (state.source || 'direct') };

            if (strictTrainerIntent) {
                persistTrainerIntent();
            }

            const result = await signInWithGoogle(targetRole, isSignup, options);
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
        } else if (hasTrainerIntent()) {
            state.role = 'trainer';
            state.source = 'join-us';
        }

        setupEvents();
        updateModeUi();

        if (state.role === 'trainer' && state.source === 'join-us' && state.mode === 'signup') {
            setNotice('Complete signup to start your trainer application.', 'success');
            return;
        }

        if (state.role === 'trainer') {
            setNotice('Trainer signup is available only from Join Us. Sign in if you already have an account.', 'error');
        }
    }

    window.addEventListener('DOMContentLoaded', init);
})();
