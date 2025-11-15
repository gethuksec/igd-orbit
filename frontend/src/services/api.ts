import axios from 'axios';

/**
 * Axios instance for API calls
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
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
      
      if (!isPublicPath) {
        // Only redirect if login route exists, otherwise just clear token
        // For now, we'll just clear the token and let the app handle it
        // window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

