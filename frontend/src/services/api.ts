import axios from 'axios';

/**
 * Axios instance for API calls
 */
export const api = axios.create({
  baseURL: '/api/v1',
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

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 unauthorized
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      // Only redirect to login if not on a public page
      const currentPath = window.location.pathname;
      const publicPaths = ['/', '/track'];
      const isPublicPath = publicPaths.some(path => currentPath === path || currentPath.startsWith('/track'));
      // Dashboard paths are protected - will need authentication
      
      if (!isPublicPath) {
        // Only redirect if login route exists, otherwise just clear token
        // For now, we'll just clear the token and let the app handle it
        // window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

