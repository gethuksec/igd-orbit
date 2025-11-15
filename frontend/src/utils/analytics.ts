// Google Analytics utility
// Initialize with: gtag('config', 'GA_MEASUREMENT_ID')

declare global {
  interface Window {
    gtag?: (
      command: 'config' | 'event' | 'js',
      targetId: string | Date,
      config?: Record<string, any>,
    ) => void;
    dataLayer?: any[];
  }
}

export const initAnalytics = (measurementId: string) => {
  if (typeof window === 'undefined') return;

  // Load Google Analytics script
  const script1 = document.createElement('script');
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script1);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    if (window.dataLayer) {
      window.dataLayer.push(arguments);
    }
  };
  window.gtag('js', new Date());
  window.gtag('config', measurementId);
};

export const trackPageView = (path: string) => {
  if (window.gtag) {
    const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    if (gaId) {
      window.gtag('config', gaId, {
        page_path: path,
      });
    }
  }
};

export const trackEvent = (
  action: string,
  category: string,
  label?: string,
  value?: number,
) => {
  if (window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
};

// Common tracking functions
export const trackServiceSearch = (serviceNumber: string) => {
  trackEvent('service_search', 'Service Tracking', serviceNumber);
};

export const trackProductView = (_productId: string, productName: string) => {
  trackEvent('product_view', 'Product', productName, undefined);
};

export const trackChatbotInteraction = (message: string) => {
  trackEvent('chatbot_interaction', 'AI Chatbot', message.substring(0, 50));
};

export const trackWhatsAppClick = (source: string) => {
  trackEvent('whatsapp_click', 'Contact', source);
};

