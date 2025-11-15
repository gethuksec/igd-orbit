import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { publicService, ServiceType, Branch } from '@/services/public.service';
import { Button } from '@/components/ui/button';
import { Search, Shield, Clock, Wrench, Star, MapPin, Phone } from 'lucide-react';
import ProductShowcase from './components/ProductShowcase';
import AIChatbot from './components/AIChatbot';
import SEOHead from './components/SEOHead';
import ServiceSearch from './components/ServiceSearch';
import { trackPageView } from '@/utils/analytics';

export default function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    trackPageView('/');
  }, []);

  const { data: serviceTypes } = useQuery<ServiceType[]>({
    queryKey: ['serviceTypes'],
    queryFn: () => publicService.getServiceTypes(),
  });

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: () => publicService.getBranches(),
  });

  const handleTrackService = (serviceNumber: string) => {
    navigate(`/track/${serviceNumber}`);
  };

  return (
    <>
      <SEOHead />
      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-20">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-5xl font-bold mb-4">IGD Group</h1>
            <p className="text-xl mb-8 text-blue-100">
              Your Trusted Electronics Retail & Service Partner
            </p>
            <div className="max-w-md mx-auto mb-8">
              <ServiceSearch onSearch={handleTrackService} />
            </div>
            <div className="flex gap-4 justify-center">
              <Button
                variant="secondary"
                onClick={() => navigate('/products')}
                size="lg"
              >
                Browse Products
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/track')}
                size="lg"
                className="bg-white text-blue-600 hover:bg-blue-50"
              >
                Track Service
              </Button>
            </div>
          </div>
        </section>

        {/* Featured Products */}
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">Featured Products</h2>
            <ProductShowcase limit={6} showViewAll={true} />
          </div>
        </section>

        {/* Services Offered */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">Our Services</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {serviceTypes && serviceTypes.length > 0 ? (
                serviceTypes.map((service) => (
                  <div
                    key={service.id}
                    className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
                  >
                    <Wrench className="w-8 h-8 text-blue-600 mb-4" />
                    <h3 className="text-xl font-semibold mb-2">{service.name}</h3>
                    {service.description && (
                      <p className="text-gray-600 mb-4">{service.description}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Price Range</p>
                        <p className="font-semibold">
                          {service.minPrice && service.maxPrice
                            ? `Rp ${service.minPrice.toLocaleString('id-ID')} - Rp ${service.maxPrice.toLocaleString('id-ID')}`
                            : `From Rp ${service.basePrice.toLocaleString('id-ID')}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">SLA</p>
                        <p className="font-semibold">
                          {service.slaHours < 24
                            ? `${service.slaHours} hours`
                            : `${Math.floor(service.slaHours / 24)} days`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center text-gray-600">
                  Service information coming soon
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Why Choose Us */}
        <section className="py-16 bg-blue-50">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">Why Choose Us</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Wrench className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="font-semibold mb-2">Professional Technicians</h3>
                <p className="text-sm text-gray-600">
                  Certified and experienced technicians
                </p>
              </div>
              <div className="text-center">
                <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="font-semibold mb-2">Genuine Parts</h3>
                <p className="text-sm text-gray-600">
                  Only original and quality parts
                </p>
              </div>
              <div className="text-center">
                <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="font-semibold mb-2">Warranty</h3>
                <p className="text-sm text-gray-600">
                  30-day warranty on all repairs
                </p>
              </div>
              <div className="text-center">
                <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="font-semibold mb-2">Fast Turnaround</h3>
                <p className="text-sm text-gray-600">
                  Quick service with SLA guarantee
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Branch Information */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">Our Branches</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {branches && branches.length > 0 ? (
                branches.map((branch) => (
                  <div
                    key={branch.id}
                    className="bg-white border border-gray-200 rounded-lg p-6"
                  >
                    <h3 className="text-xl font-semibold mb-4">{branch.name}</h3>
                    <div className="space-y-2 text-sm">
                      {branch.address && (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 mt-0.5 text-gray-500" />
                          <div>
                            <p>{branch.address}</p>
                            {branch.city && branch.province && (
                              <p className="text-gray-500">
                                {branch.city}, {branch.province}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      {branch.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-500" />
                          <a
                            href={`tel:${branch.phone}`}
                            className="text-blue-600 hover:underline"
                          >
                            {branch.phone}
                          </a>
                        </div>
                      )}
                      {branch.email && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">✉</span>
                          <a
                            href={`mailto:${branch.email}`}
                            className="text-blue-600 hover:underline"
                          >
                            {branch.email}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center text-gray-600">
                  Branch information coming soon
                </div>
              )}
            </div>
          </div>
        </section>

        {/* AI Chatbot */}
        <AIChatbot />
      </div>
    </>
  );
}

