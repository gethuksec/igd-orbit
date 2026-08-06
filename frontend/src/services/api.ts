import axios, { AxiosError, AxiosRequestConfig } from 'axios';

/**
 * Axios instance for API calls
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Helper function to handle API errors gracefully
export const handleApiError = <T>(error: any, fallback: T): T => {
  // Network errors (backend not running)
  if (error.code === 'ERR_NETWORK' || error.message?.includes('ERR_CONNECTION_REFUSED')) {
    console.warn('Backend not available, returning fallback data');
    return fallback;
  }
  
  // HTTP errors (404, 500, etc.)
  if (error.response) {
    const status = error.response.status;
    if (status === 404 || status === 500 || status >= 500) {
      console.warn(`API error ${status}, returning fallback data`);
      return fallback;
    }
  }
  
  throw error;
};

// ---------------------------------------------------------------------------
// T22 — Global 401 (Session Expired) Handling
// ---------------------------------------------------------------------------

// Auth endpoints that must NEVER trigger the session-expired handler
// (prevents redirect loops + wrong-password being shown as "session expired")
const AUTH_EXCLUSION_PATHS = [
  '/auth/login',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
];

const isAuthExcluded = (url: string = '') =>
  AUTH_EXCLUSION_PATHS.some((p) => url.includes(p));

// Public pages don't require a session — clear stale token, no redirect
const isPublicPath = () => {
  const { pathname } = window.location;
  return pathname === '/' || pathname.startsWith('/track');
};

const clearSession = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
};

// Full page redirect (not router navigation) — the interceptor runs outside
// React context. ?expired=1 makes the login page show the session message
// (a toast would die mid-display on page unload). ?next= preserves the
// destination so the user lands back where they were after re-login.
const redirectToLogin = () => {
  const { pathname, search } = window.location;
  const next = encodeURIComponent(pathname + search);
  window.location.assign(`/login?expired=1&next=${next}`);
};

// Dedupe flag — parallel 401s (e.g. dashboard firing 5 queries) produce
// exactly one redirect. Module state resets on the full page load.
let isHandling401 = false;

// ---------------------------------------------------------------------------
// Silent refresh (single-flight): while a refresh is in flight, every other
// request that 401s awaits the SAME promise, then retries with the new token.
// ---------------------------------------------------------------------------
let refreshPromise: Promise<string | null> | null = null;

const doRefresh = async (): Promise<string | null> => {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return null;

  try {
    // Bare axios (not `api`) so this never re-enters the interceptor
    const res = await axios.post(
      `${api.defaults.baseURL}/auth/refresh`,
      { refreshToken },
      { headers: { 'Content-Type': 'application/json' } }
    );
    const data = res.data?.data || res.data;
    const newToken = data.accessToken || data.access_token;
    if (newToken) {
      localStorage.setItem('access_token', newToken);
    }
    return newToken || null;
  } catch (e) {
    return null;
  }
};

const refreshAccessToken = (): Promise<string | null> => {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

const handleSessionExpired = () => {
  if (isHandling401) return; // already redirecting
  isHandling401 = true;
  clearSession();
  redirectToLogin();
};

type RetriableConfig = AxiosRequestConfig & { _retried?: boolean };

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const url = error.config?.url || '';

    if (status === 401) {
      // 1. Never touch auth endpoints themselves
      if (isAuthExcluded(url)) {
        return Promise.reject(error);
      }

      // 2. Public pages: just drop the stale token, no redirect
      if (isPublicPath()) {
        clearSession();
        return Promise.reject(error);
      }

      // 3. Try silent refresh once — replay the original request with the new token.
      //    _retried guards against a loop if the replayed request 401s again.
      const config = error.config as RetriableConfig | undefined;
      if (!isHandling401 && config && !config._retried) {
        const newToken = await refreshAccessToken();
        if (newToken) {
          config._retried = true;
          config.headers = {
            ...(config.headers || {}),
            Authorization: `Bearer ${newToken}`,
          };
          return api.request(config);
        }
      }

      // 4. Refresh failed (or no refresh token) → session expired
      handleSessionExpired();
    }
    return Promise.reject(error);
  }
);
