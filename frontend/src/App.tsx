import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'sonner';
import POSPage from './pages/sales/pos/POSPage';
import LandingPage from './pages/public/LandingPage';
import ServiceTracking from './pages/public/ServiceTracking';
import { initAnalytics } from './utils/analytics';
import './App.css';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  useEffect(() => {
    // Initialize Google Analytics if measurement ID is provided
    const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    if (gaId) {
      initAnalytics(gaId);
    }
  }, []);

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/track" element={<ServiceTracking />} />
            <Route path="/track/:serviceNumber" element={<ServiceTracking />} />
            
            {/* POS Route */}
            <Route path="/sales/pos" element={<POSPage />} />
            
            {/* 404 - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" />
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
