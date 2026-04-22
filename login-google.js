(function () {
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
                const result = await signUp(name, email, password, 'client', null, null);
                if (!result?.success) {
                    setNotice(result?.error || 'Sign up failed. Please try again.', 'error');
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

            const userRole = result?.user?.role || state.role || 'client';
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
            const targetRole = isSignup ? 'client' : state.role;
            const options = isSignup ? { signupSource: 'public' } : { signupSource: state.source || 'direct' };

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
        if (state.role === 'trainer' && state.mode === 'signup') {
            state.mode = 'signin';
        }

        setupEvents();
        updateModeUi();

        if (state.role === 'trainer') {
            setNotice('Trainer account creation is not available on this page. Sign in if you already have an account.', 'error');
        }
    }

    window.addEventListener('DOMContentLoaded', init);
})();
