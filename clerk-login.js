const CLERK_KEY_STORAGE = 'onlifit_clerk_publishable_key';
const ROLE_STORAGE = 'onlifit_user_role';
const CLERK_JS_VERSION = '6.7.4';
const CLERK_SCRIPT_URLS = [
  '/node_modules/@clerk/clerk-js/dist/clerk.browser.js',
  './node_modules/@clerk/clerk-js/dist/clerk.browser.js',
  `https://cdn.jsdelivr.net/npm/@clerk/clerk-js@${CLERK_JS_VERSION}/dist/clerk.browser.js`,
  `https://unpkg.com/@clerk/clerk-js@${CLERK_JS_VERSION}/dist/clerk.browser.js`
];

let activeAuthMode = null;
let isMountingAuth = false;

function decodeFrontendApiFromPublishableKey(publishableKey) {
  try {
    if (!publishableKey || !publishableKey.startsWith('pk_')) return '';
    const encodedSegment = publishableKey.split('_')[2] || '';
    if (!encodedSegment) return '';

    const normalized = encodedSegment
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(encodedSegment.length / 4) * 4, '=');

    const decoded = atob(normalized);
    return decoded.endsWith('$') ? decoded.slice(0, -1) : decoded;
  } catch {
    return '';
  }
}

function getClerkScriptUrls(publishableKey) {
  const frontendApi = decodeFrontendApiFromPublishableKey(publishableKey);
  const officialUrls = frontendApi
    ? [
        `https://${frontendApi}/npm/@clerk/clerk-js@${CLERK_JS_VERSION}/dist/clerk.browser.js`
      ]
    : [];

  return [...new Set([...officialUrls, ...CLERK_SCRIPT_URLS])];
}

async function loadScript(url, publishableKey) {
  await new Promise((resolve, reject) => {
    window.__clerk_publishable_key = publishableKey;

    const existing = document.querySelector(`script[src="${url}"]`);
    if (existing && window.Clerk) {
      resolve();
      return;
    }

    const timeoutMs = 10000;
    const script = document.createElement('script');
    script.src = url;
    script.setAttribute('data-clerk-publishable-key', publishableKey);
    script.setAttribute('data-onlifit-clerk-loader', '1');
    script.async = true;

    const timeoutId = window.setTimeout(() => {
      script.remove();
      reject(new Error(`Timed out loading Clerk script from ${url}`));
    }, timeoutMs);

    script.onload = () => {
      window.clearTimeout(timeoutId);
      resolve();
    };

    script.onerror = () => {
      window.clearTimeout(timeoutId);
      reject(new Error(`Failed to load Clerk script from ${url}`));
    };

    document.head.appendChild(script);
  });
}

function getParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function parseRole(value) {
  return value === 'trainer' || value === 'client' || value === 'admin' ? value : '';
}

function getStoredRole() {
  return parseRole(localStorage.getItem(ROLE_STORAGE)) || 'client';
}

function setResolvedRole(role) {
  const normalized = parseRole(role) || 'client';
  localStorage.setItem(ROLE_STORAGE, normalized);
  return normalized;
}

function getRedirectUrl(role) {
  const redirectParam = getParam('redirect');
  if (redirectParam) return redirectParam;
  return parseRole(role) === 'trainer' ? 'bookings.html' : 'client-dashboard.html';
}

function getPostAuthReturnUrl(mode = 'signin') {
  const params = new URLSearchParams(window.location.search);
  params.set('mode', mode === 'signup' ? 'signup' : 'signin');
  return `login.html?${params.toString()}`;
}

function getClerkPrimaryEmail(clerkUser) {
  return clerkUser?.primaryEmailAddress?.emailAddress || clerkUser?.emailAddresses?.[0]?.emailAddress || '';
}

function getFrontendApiFromKey() {
  return decodeFrontendApiFromPublishableKey(getPublishableKey()) || '';
}

function getHostedAuthUrl(mode) {
  const frontendApi = getFrontendApiFromKey();
  if (!frontendApi) return '';

  const path = mode === 'signup' ? 'sign-up' : 'sign-in';
  const returnUrl = getPostAuthReturnUrl(mode);
  const url = new URL(`https://${frontendApi}/${path}`);
  url.searchParams.set('redirect_url', new URL(returnUrl, window.location.origin).toString());
  return url.toString();
}

async function resolveRoleFromCredentials(clerkUser) {
  const roleFromMetadata = parseRole(
    clerkUser?.unsafeMetadata?.role || clerkUser?.publicMetadata?.role || clerkUser?.privateMetadata?.role || ''
  );
  if (roleFromMetadata) {
    return setResolvedRole(roleFromMetadata);
  }

  const sb = window.supabaseClient || window.supabase;
  if (!sb) {
    return setResolvedRole('client');
  }

  const clerkUserId = clerkUser?.id || '';
  if (clerkUserId) {
    const byClerkId = await sb
      .from('profiles')
      .select('role')
      .eq('clerk_id', clerkUserId)
      .limit(1);

    if (!byClerkId.error && Array.isArray(byClerkId.data) && byClerkId.data.length > 0) {
      return setResolvedRole(byClerkId.data[0].role);
    }

    const clerkIdErrorMsg = String(byClerkId.error?.message || '').toLowerCase();
    if (byClerkId.error && !clerkIdErrorMsg.includes('clerk_id')) {
      console.warn('Role lookup by clerk_id failed:', byClerkId.error.message || byClerkId.error);
    }
  }

  const email = getClerkPrimaryEmail(clerkUser);
  if (email) {
    const byEmail = await sb
      .from('profiles')
      .select('role')
      .ilike('email', email)
      .limit(1);

    if (!byEmail.error && Array.isArray(byEmail.data) && byEmail.data.length > 0) {
      return setResolvedRole(byEmail.data[0].role);
    }

    if (byEmail.error) {
      console.warn('Role lookup by email failed:', byEmail.error.message || byEmail.error);
    }
  }

  return setResolvedRole('client');
}

function getPublishableKey() {
  const metaKey = document.querySelector('meta[name="clerk-publishable-key"]')?.content?.trim();
  const windowKey = (window.CLERK_PUBLISHABLE_KEY || '').trim();
  const storedKey = (localStorage.getItem(CLERK_KEY_STORAGE) || '').trim();
  return windowKey || metaKey || storedKey;
}

function getKeySource() {
  const metaKey = document.querySelector('meta[name="clerk-publishable-key"]')?.content?.trim();
  const windowKey = (window.CLERK_PUBLISHABLE_KEY || '').trim();
  const storedKey = (localStorage.getItem(CLERK_KEY_STORAGE) || '').trim();
  if (windowKey) return 'window.CLERK_PUBLISHABLE_KEY';
  if (metaKey) return 'meta[name="clerk-publishable-key"]';
  if (storedKey) return 'localStorage';
  return 'none';
}

function renderInitError(message, detail = '') {
  const host = document.getElementById('clerk-auth');
  const isFile = window.location.protocol === 'file:';
  const currentOrigin = `${window.location.protocol}//${window.location.host}`;

  host.innerHTML = `
    <div class="text-left rounded-xl border border-red-200 bg-red-50 p-4">
      <p class="text-sm text-red-700 font-semibold mb-2">Unable to initialize Clerk</p>
      <p class="text-xs text-red-700">${message}</p>
      ${detail ? `<p class="text-xs text-red-600 mt-2">${detail}</p>` : ''}
      <div class="mt-3 text-xs text-red-700 space-y-1">
        <p><strong>Current origin:</strong> ${isFile ? 'file://' : currentOrigin}</p>
        <p><strong>Key source:</strong> ${getKeySource()}</p>
      </div>
      ${isFile ? `
        <div class="mt-3 text-xs text-red-700 bg-white/70 border border-red-200 rounded-lg p-3">
          <p class="font-semibold mb-1">Use HTTP for Clerk (not file://)</p>
          <p>Run this from project root:</p>
          <code class="block mt-1 p-2 rounded bg-slate-900 text-slate-100">python -m http.server 5500</code>
          <p class="mt-2">Then open: <strong>http://localhost:5500/login.html</strong></p>
        </div>
      ` : ''}
    </div>
  `;
}

function normalizeDevOrigin() {
  if (window.location.hostname !== '127.0.0.1') return false;

  const redirectUrl = `${window.location.protocol}//localhost:${window.location.port}${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(redirectUrl);
  return true;
}

function renderKeySetup() {
  const setup = document.getElementById('clerk-setup');
  setup.classList.remove('hidden');
  setup.innerHTML = `
    <p class="text-sm font-bold mb-2">Clerk key required</p>
    <p class="text-xs text-on-surface-variant mb-3">Paste your Clerk publishable key (pk_...) to enable auth on this site.</p>
    <label class="block text-xs font-semibold mb-1" for="clerk-key-input">Publishable key</label>
    <input id="clerk-key-input" type="text" class="w-full px-3 py-2 rounded-lg border border-outline-variant/60 bg-surface text-sm" placeholder="pk_test_..." />
    <button id="save-clerk-key" type="button" class="mt-3 w-full py-2.5 rounded-lg bg-primary text-on-primary font-bold">Save key and continue</button>
  `;

  const saveBtn = document.getElementById('save-clerk-key');
  saveBtn.addEventListener('click', () => {
    const value = document.getElementById('clerk-key-input').value.trim();
    if (!value.startsWith('pk_')) {
      alert('Please enter a valid Clerk publishable key starting with pk_.');
      return;
    }
    localStorage.setItem(CLERK_KEY_STORAGE, value);
    window.location.reload();
  });
}

async function loadClerkScript(publishableKey) {
  // Reset previously loaded Clerk scripts/global to avoid getting stuck with a non-UI runtime.
  document.querySelectorAll('script[data-onlifit-clerk-loader="1"]').forEach((script) => script.remove());
  try {
    delete window.Clerk;
  } catch {
    window.Clerk = undefined;
  }

  const errors = [];
  const scriptUrls = getClerkScriptUrls(publishableKey);

  for (const scriptUrl of scriptUrls) {
    try {
      await loadScript(scriptUrl, publishableKey);

      if (window.Clerk) {
        return;
      }

      errors.push(`Loaded ${scriptUrl} but window.Clerk was not available`);
    } catch (error) {
      errors.push(error?.message || `Unknown error while loading ${scriptUrl}`);
    }
  }

  throw new Error(`Failed to load Clerk script. Attempts: ${errors.join(' | ')}`);
}

function showSignedInView() {
  safeUnmountAuthWidgets();
  document.getElementById('clerk-auth').classList.add('hidden');
  document.getElementById('auth-mode-switcher').classList.add('hidden');
  document.getElementById('clerk-signed-in').classList.remove('hidden');

  const userButtonDiv = document.getElementById('clerk-user-button');
  userButtonDiv.innerHTML = '';
  window.Clerk.mountUserButton(userButtonDiv);

  document.getElementById('continue-btn').onclick = () => {
    window.location.href = getRedirectUrl(localStorage.getItem(ROLE_STORAGE));
  };

  document.getElementById('signout-btn').onclick = async () => {
    await window.Clerk.signOut();
    window.location.reload();
  };
}

function openAuthModal(mode) {
  const returnUrl = getPostAuthReturnUrl(mode);
  const options = {
    afterSignInUrl: returnUrl,
    afterSignUpUrl: returnUrl
  };

  try {
    if (mode === 'signup') {
      window.Clerk.openSignUp(options);
      return;
    }

    window.Clerk.openSignIn(options);
    return;
  } catch (error) {
    const hostedUrl = getHostedAuthUrl(mode);
    if (hostedUrl) {
      window.location.assign(hostedUrl);
      return;
    }
    throw error;
  }
}

function renderModalFallback(mode) {
  const host = document.getElementById('clerk-auth');
  if (!host) return;

  const actionLabel = mode === 'signup' ? 'Open Sign up' : 'Open Sign in';
  const hostedUrl = getHostedAuthUrl(mode);
  host.innerHTML = `
    <div class="text-left rounded-xl border border-outline-variant/40 bg-surface p-4">
      <p class="text-sm font-semibold text-on-surface mb-1">Secure authentication</p>
      <p class="text-xs text-on-surface-variant mb-3">Inline auth is unavailable right now. Continue with hosted Clerk auth.</p>
      <button id="clerk-fallback-open" type="button" class="w-full py-2.5 rounded-lg bg-primary text-on-primary font-bold">${actionLabel}</button>
      ${hostedUrl ? `<a href="${hostedUrl}" class="block w-full text-center mt-2 py-2.5 rounded-lg border border-outline-variant/60 text-on-surface font-bold">Open in new auth page</a>` : ''}
    </div>
  `;

  const openBtn = document.getElementById('clerk-fallback-open');
  if (openBtn) {
    openBtn.addEventListener('click', () => openAuthModal(mode));
  }
}

function awaitWithTimeout(promiseLike, timeoutMs, label) {
  if (!promiseLike || typeof promiseLike.then !== 'function') {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promiseLike
      .then((value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });
}

async function mountInlineAuth(mode, host, returnUrl) {
  const mountTimeoutMs = 3000;

  if (mode === 'signup') {
    const result = window.Clerk.mountSignUp(host, {
      signInUrl: 'login.html?mode=signin',
      afterSignUpUrl: returnUrl,
      oauthFlow: 'popup'
    });
    await awaitWithTimeout(result, mountTimeoutMs, 'Clerk SignUp mount');
    return;
  }

  const result = window.Clerk.mountSignIn(host, {
    signUpUrl: 'login.html?mode=signup',
    afterSignInUrl: returnUrl,
    oauthFlow: 'popup'
  });
  await awaitWithTimeout(result, mountTimeoutMs, 'Clerk SignIn mount');
}

async function mountAuth(mode) {
  const host = document.getElementById('clerk-auth');

  if (!host || !window.Clerk) return;
  if (isMountingAuth) return;
  if (activeAuthMode === mode && host.childElementCount > 0) return;

  isMountingAuth = true;

  const setModeClasses = (currentMode) => {
    const signInBtn = document.getElementById('mode-signin');
    const signUpBtn = document.getElementById('mode-signup');
    if (!signInBtn || !signUpBtn) return;

    if (currentMode === 'signup') {
      signUpBtn.classList.add('bg-primary', 'text-on-primary');
      signUpBtn.classList.remove('border', 'border-outline-variant/50', 'text-on-surface');
      signInBtn.classList.remove('bg-primary', 'text-on-primary');
      signInBtn.classList.add('border', 'border-outline-variant/50', 'text-on-surface');
    } else {
      signInBtn.classList.add('bg-primary', 'text-on-primary');
      signInBtn.classList.remove('border', 'border-outline-variant/50', 'text-on-surface');
      signUpBtn.classList.remove('bg-primary', 'text-on-primary');
      signUpBtn.classList.add('border', 'border-outline-variant/50', 'text-on-surface');
    }
  };

  const returnUrl = getPostAuthReturnUrl(mode);

  try {
    safeUnmountAuthWidgets();
    host.replaceChildren();
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    setModeClasses(mode);

    try {
      await mountInlineAuth(mode, host, returnUrl);
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));

      if (host.childElementCount === 0) {
        console.warn('Clerk inline auth mounted with empty host. Falling back to popup mode.');
        renderModalFallback(mode);
        try {
          openAuthModal(mode);
        } catch (modalError) {
          console.warn('Clerk modal auth failed, showing hosted auth link only.', modalError?.message || modalError);
        }
      }
    } catch (mountError) {
      console.warn('Clerk inline auth failed. Falling back to popup mode.', mountError?.message || mountError);
      renderModalFallback(mode);
      try {
        openAuthModal(mode);
      } catch (modalError) {
        console.warn('Clerk modal auth failed, showing hosted auth link only.', modalError?.message || modalError);
      }
    }

    activeAuthMode = mode;
  } finally {
    isMountingAuth = false;
  }
}

function safeUnmountAuthWidgets() {
  if (!window.Clerk) return;

  const host = document.getElementById('clerk-auth');
  const unmountFns = ['unmountSignIn', 'unmountSignUp'];

  unmountFns.forEach((fnName) => {
    const fn = window.Clerk?.[fnName];
    if (typeof fn !== 'function') return;

    try {
      fn(host);
    } catch {
      try {
        fn();
      } catch {
        // Non-fatal during transitions.
      }
    }
  });

  if (host && host.childNodes.length > 0) {
    host.replaceChildren();
  }
}

async function init() {
  if (normalizeDevOrigin()) return;

  const publishableKey = getPublishableKey();
  if (!publishableKey) {
    renderKeySetup();
    return;
  }

  try {
    if (window.location.protocol === 'file:') {
      renderInitError('Clerk blocks authentication on file:// origins.', 'Start a local HTTP server and open login.html via localhost.');
      return;
    }

    await loadClerkScript(publishableKey);
    await window.Clerk.load({ publishableKey });

    if (window.Clerk.isSignedIn) {
      const detectedRole = await resolveRoleFromCredentials(window.Clerk.user);
      window.location.replace(getRedirectUrl(detectedRole));
      return;
    }

    const modeParam = getParam('mode');
    const startMode = modeParam === 'signup' ? 'signup' : 'signin';

    document.getElementById('mode-signin').addEventListener('click', () => mountAuth('signin'));
    document.getElementById('mode-signup').addEventListener('click', () => mountAuth('signup'));

    await mountAuth(startMode);
  } catch (error) {
    console.error(error);
    const detail = error?.message || 'Unknown error';
    renderInitError(
      'Check your publishable key and add this origin in Clerk Dashboard allowed origins/redirect URLs.',
      detail
    );
  }
}

init();
