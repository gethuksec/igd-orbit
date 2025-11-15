import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Shield, Clock, Wrench, MapPin, Phone, Star, TrendingUp, Award, Users, ArrowRight, Sparkles } from 'lucide-react';
import ProductShowcase from './components/ProductShowcase';
import AIChatbot from './components/AIChatbot';
import SEOHead from './components/SEOHead';
import ServiceSearch from './components/ServiceSearch';
import { trackPageView } from '@/utils/analytics';
import { publicService } from '@/services/public.service';
import type { ServiceType, Branch } from '@/services/public.service';

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
        {/* Hero Section - Enhanced */}
        <section className="relative bg-gradient-to-r from-primary-600 via-primary-500 to-primary-600 text-white py-24 overflow-hidden">
          {/* Animated Background Elements */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
          </div>

          <div className="container mx-auto px-4 text-center relative z-10">
            {/* Logo & Brand */}
            <div className="flex items-center justify-center gap-4 mb-6 animate-fade-in">
              <div className="flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-md rounded-2xl shadow-xl border border-white/30">
                <Wrench className="w-10 h-10" />
              </div>
              <div>
                <h1 className="text-6xl font-bold mb-2 bg-gradient-to-r from-white to-primary-100 bg-clip-text text-transparent">
                  IGD Group
                </h1>
                <div className="flex items-center justify-center gap-2 text-primary-100">
                  <Star className="w-4 h-4 fill-current" />
                  <span className="text-sm font-medium">Trusted Since 2010</span>
                  <Star className="w-4 h-4 fill-current" />
                </div>
              </div>
            </div>

            <p className="text-2xl mb-4 text-primary-100 font-light">
              Your Trusted Electronics Retail & Service Partner
            </p>
            <p className="text-lg mb-10 text-white/80 max-w-2xl mx-auto">
              Solusi lengkap untuk kebutuhan elektronik Anda. Dari penjualan hingga perbaikan, kami hadir dengan layanan terbaik.
            </p>

            {/* Service Search - Enhanced */}
            <div className="max-w-2xl mx-auto mb-10">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-2xl">
                <ServiceSearch onSearch={handleTrackService} />
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-4 justify-center">
              <button
                onClick={() => navigate('/login')}
                className="group px-8 py-4 bg-white text-primary-600 rounded-xl font-bold hover:bg-primary-50 transition-all shadow-xl hover:shadow-2xl hover:scale-105 flex items-center gap-2"
              >
                <span>Masuk ke Dashboard</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => navigate('/products')}
                className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white border-2 border-white rounded-xl font-bold hover:bg-white/20 transition-all shadow-lg hover:shadow-xl"
              >
                Jelajahi Produk
              </button>
            </div>

            {/* Stats Bar */}
            <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                <div className="text-3xl font-bold mb-1">10K+</div>
                <div className="text-sm text-primary-100">Pelanggan Puas</div>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                <div className="text-3xl font-bold mb-1">50K+</div>
                <div className="text-sm text-primary-100">Produk Tersedia</div>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                <div className="text-3xl font-bold mb-1">15+</div>
                <div className="text-sm text-primary-100">Cabang</div>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                <div className="text-3xl font-bold mb-1">98%</div>
                <div className="text-sm text-primary-100">Kepuasan</div>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Products - Enhanced */}
        <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Produk Unggulan</h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Temukan produk elektronik terbaik dengan kualitas premium dan harga terbaik
              </p>
            </div>
            <ProductShowcase limit={6} showViewAll={true} />
          </div>
        </section>

        {/* Services Offered - Enhanced */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Layanan Kami</h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Layanan perbaikan profesional dengan garansi dan teknisi berpengalaman
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {serviceTypes && serviceTypes.length > 0 ? (
                serviceTypes.map((service, index) => (
                  <div
                    key={service.id}
                    className="group bg-white border-2 border-gray-200 rounded-2xl p-8 hover:border-primary-300 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <Wrench className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3 text-gray-900">{service.name}</h3>
                    {service.description && (
                      <p className="text-gray-600 mb-6 leading-relaxed">{service.description}</p>
                    )}
                    <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Harga Mulai</p>
                        <p className="text-lg font-bold text-primary-600">
                          {service.minPrice && service.maxPrice
                            ? `Rp ${service.minPrice.toLocaleString('id-ID')} - Rp ${service.maxPrice.toLocaleString('id-ID')}`
                            : `Rp ${service.basePrice.toLocaleString('id-ID')}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 mb-1">SLA</p>
                        <p className="text-lg font-bold text-gray-900">
                          {service.slaHours < 24
                            ? `${service.slaHours} jam`
                            : `${Math.floor(service.slaHours / 24)} hari`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center text-gray-600 py-12">
                  <Wrench className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg">Informasi layanan akan segera tersedia</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Why Choose Us - Enhanced */}
        <section className="py-20 bg-gradient-to-br from-primary-50 via-white to-accent-50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Mengapa Memilih Kami?</h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Komitmen kami untuk memberikan layanan terbaik dengan standar kualitas tinggi
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                {
                  icon: Wrench,
                  title: 'Teknisi Profesional',
                  description: 'Teknisi bersertifikat dan berpengalaman di bidangnya',
                  color: 'from-blue-500 to-blue-600',
                },
                {
                  icon: Shield,
                  title: 'Sparepart Asli',
                  description: 'Hanya menggunakan sparepart original dan berkualitas',
                  color: 'from-green-500 to-green-600',
                },
                {
                  icon: Award,
                  title: 'Garansi 30 Hari',
                  description: 'Garansi 30 hari untuk semua perbaikan yang dilakukan',
                  color: 'from-yellow-500 to-yellow-600',
                },
                {
                  icon: Clock,
                  title: 'Cepat & Tepat',
                  description: 'Layanan cepat dengan jaminan SLA yang terpenuhi',
                  color: 'from-purple-500 to-purple-600',
                },
              ].map((feature, index) => (
                <div
                  key={index}
                  className="group text-center bg-white rounded-2xl p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border border-gray-100"
                >
                  <div className={`w-20 h-20 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform shadow-lg`}>
                    <feature.icon className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-gray-900">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Branch Information - Enhanced */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Cabang Kami</h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Temukan cabang terdekat untuk melayani kebutuhan Anda
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {branches && branches.length > 0 ? (
                branches.map((branch) => (
                  <div
                    key={branch.id}
                    className="bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 rounded-2xl p-8 hover:border-primary-300 hover:shadow-xl transition-all duration-300"
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center">
                        <MapPin className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900">{branch.name}</h3>
                    </div>
                    <div className="space-y-4 text-sm">
                      {branch.address && (
                        <div className="flex items-start gap-3">
                          <MapPin className="w-5 h-5 mt-0.5 text-primary-600 flex-shrink-0" />
                          <div>
                            <p className="text-gray-900 font-medium">{branch.address}</p>
                            {branch.city && branch.province && (
                              <p className="text-gray-600 mt-1">
                                {branch.city}, {branch.province}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      {branch.phone && (
                        <div className="flex items-center gap-3">
                          <Phone className="w-5 h-5 text-primary-600 flex-shrink-0" />
                          <a
                            href={`tel:${branch.phone}`}
                            className="text-primary-600 hover:text-primary-700 hover:underline transition-colors font-medium"
                          >
                            {branch.phone}
                          </a>
                        </div>
                      )}
                      {branch.email && (
                        <div className="flex items-center gap-3">
                          <span className="text-primary-600">✉</span>
                          <a
                            href={`mailto:${branch.email}`}
                            className="text-primary-600 hover:text-primary-700 hover:underline transition-colors font-medium"
                          >
                            {branch.email}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center text-gray-600 py-12">
                  <MapPin className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg">Informasi cabang akan segera tersedia</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-gradient-to-r from-primary-600 to-primary-500 text-white">
          <div className="container mx-auto px-4 text-center">
            <Sparkles className="w-16 h-16 mx-auto mb-6 text-white/80" />
            <h2 className="text-4xl font-bold mb-4">Siap Memulai?</h2>
            <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
              Bergabunglah dengan ribuan pelanggan yang telah mempercayai IGD Group untuk kebutuhan elektronik mereka
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <button
                onClick={() => navigate('/login')}
                className="px-8 py-4 bg-white text-primary-600 rounded-xl font-bold hover:bg-primary-50 transition-all shadow-xl hover:shadow-2xl hover:scale-105 flex items-center gap-2"
              >
                <span>Masuk Sekarang</span>
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigate('/track')}
                className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white border-2 border-white rounded-xl font-bold hover:bg-white/20 transition-all shadow-lg"
              >
                Lacak Service
              </button>
            </div>
          </div>
        </section>

        {/* AI Chatbot */}
        <AIChatbot />
      </div>
    </>
  );
}
