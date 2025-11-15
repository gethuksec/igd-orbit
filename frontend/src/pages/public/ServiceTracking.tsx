import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { publicService } from '@/services/public.service';
import type { ServiceTrackingData } from '@/services/public.service';
import ServiceSearch from './components/ServiceSearch';
import ServiceInfo from './components/ServiceInfo';
import StatusTimeline from './components/StatusTimeline';
import ContactSupport from './components/ContactSupport';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trackPageView, trackServiceSearch } from '@/utils/analytics';

export default function ServiceTracking() {
  const { serviceNumber: paramServiceNumber } = useParams<{ serviceNumber?: string }>();
  const navigate = useNavigate();
  const [searchServiceNumber, setSearchServiceNumber] = useState<string>(
    paramServiceNumber || '',
  );

  const {
    data: serviceData,
    isLoading,
    error,
  } = useQuery<ServiceTrackingData>({
    queryKey: ['serviceTracking', searchServiceNumber],
    queryFn: () => publicService.trackService(searchServiceNumber),
    enabled: !!searchServiceNumber && searchServiceNumber.length > 0,
    retry: 1,
  });

  useEffect(() => {
    trackPageView('/track');
  }, []);

  const handleSearch = (serviceNumber: string) => {
    setSearchServiceNumber(serviceNumber);
    trackServiceSearch(serviceNumber);
    navigate(`/track/${serviceNumber}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Track Your Service
          </h1>
          <p className="text-gray-600">
            Enter your service number to check the status of your device repair
          </p>
        </div>

        {/* Search */}
        <div className="mb-8">
          <ServiceSearch
            onSearch={handleSearch}
            isLoading={isLoading}
            error={error ? 'Service not found. Please check your service number.' : undefined}
          />
        </div>

        {/* Results */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading service information...</p>
          </div>
        )}

        {error && !isLoading && searchServiceNumber && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800 font-medium">
              Service not found
            </p>
            <p className="text-red-600 text-sm mt-2">
              Please verify your service number and try again.
            </p>
          </div>
        )}

        {serviceData && !isLoading && (
          <div className="space-y-6">
            <ServiceInfo
              serviceNumber={serviceData.serviceNumber}
              deviceType={serviceData.deviceType}
              deviceBrand={serviceData.deviceBrand}
              deviceModel={serviceData.deviceModel}
              status={serviceData.status}
              receivedDate={serviceData.receivedDate}
              promisedDate={serviceData.promisedDate}
              estimatedCompletion={serviceData.estimatedCompletion}
            />

            <StatusTimeline
              currentStatus={serviceData.status}
              statusHistory={serviceData.statusHistory}
            />

            <ContactSupport />
          </div>
        )}

        {/* Empty State */}
        {!searchServiceNumber && !isLoading && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-600">
              Enter your service number above to track your device repair status
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

