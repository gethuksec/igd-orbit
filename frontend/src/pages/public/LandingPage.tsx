import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Clock,
  Wrench,
  MapPin,
  Phone,
  Star,
  Award,
  Sparkles,
  Instagram,
  Facebook,
} from 'lucide-react';
// import ProductShowcase from './components/ProductShowcase';
import AIChatbot from './components/AIChatbot';
import SEOHead from './components/SEOHead';
import ServiceSearch from './components/ServiceSearch';
import { trackPageView } from '@/utils/analytics';
import { publicService } from '@/services/public.service';
import type { ServiceType, PopularProduct } from '@/services/public.service';

export default function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    trackPageView('/');
  }, []);

  const { data: serviceTypes } = useQuery<ServiceType[]>({
    queryKey: ['serviceTypes'],
    queryFn: () => publicService.getServiceTypes(),
  });

  const { data: popularProducts } = useQuery<PopularProduct[]>({
    queryKey: ['popular-products'],
    queryFn: () => publicService.getPopularProducts(5),
  });

  const handleTrackService = (serviceNumber: string) => {
    navigate(`/track/${serviceNumber}`);
  };

  return (
    <>
      <SEOHead />
      <div className="min-h-screen bg-white flex flex-col">
        {/* Top Navigation */}
        <header className="w-full border-b border-gray-100 bg-white/80 backdrop-blur z-20">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Logo utama di navbar */}
              <img
                src="/logo/igd-1.jpg"
                alt="IGD Ponsel Logo"
                className="h-8 w-auto object-contain"
              />
              <div className="leading-tight">
                <p className="text-sm font-semibold text-gray-900">IGD Ponsel</p>
                <p className="text-xs text-gray-500">Servis • Sparepart • Accessories</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span>Buka setiap hari 08.00 – 21.00 WIB</span>
                </div>
              </div>
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-primary-600 border border-primary-200 bg-white hover:bg-primary-50 transition-colors"
              >
                Masuk / Login
              </button>
            </div>
          </div>
        </header>

        {/* Hero Section - Enhanced */}
        <section className="relative bg-gradient-to-r from-[#b9051f] via-[#e11b22] to-[#b9051f] text-white py-24 overflow-hidden">
          {/* Animated Background Elements */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
          </div>

          <div className="container mx-auto px-4 text-center relative z-10">
            {/* Brand */}
            <div className="flex items-center justify-center gap-4 mb-6 animate-fade-in">
              <div>
                <h1 className="text-5xl md:text-6xl font-extrabold mb-2 tracking-tight bg-gradient-to-r from-white to-red-100 bg-clip-text text-transparent">
                  IGD Ponsel
                </h1>
                <div className="flex flex-wrap items-center justify-center gap-2 text-red-50">
                  <Star className="w-4 h-4 fill-current" />
                  <span className="text-sm font-medium uppercase tracking-wide">Servis • Aksesoris • Sparepart</span>
                  <Star className="w-4 h-4 fill-current" />
                </div>
              </div>
            </div>

            <p className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm font-semibold text-red-50 mb-4">
              <Sparkles className="w-4 h-4" />
              Servis handphone, sparepart & aksesoris di Jember & Kalisat
            </p>
            <p className="text-2xl mb-4 text-red-50 font-semibold">
              Servis cepat, bergaransi, dan sparepart asli dengan pelayanan ramah
            </p>
            <p className="text-lg mb-10 text-white/80 max-w-3xl mx-auto">
              Dari ganti LCD, baterai, hingga perbaikan kerusakan berat – IGD Ponsel siap membantu Anda setiap hari
              dengan teknisi berpengalaman dan jaringan cabang yang mudah dijangkau.
            </p>

            {/* Service Search - Enhanced */}
            <div className="max-w-2xl mx-auto mb-10">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-2xl">
                <ServiceSearch onSearch={handleTrackService} />
              </div>
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

        {/* Best Seller Products (Public Carousel) */}
        <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-3">
              <h2 className="text-4xl font-bold text-gray-900 mb-2">Produk Best Seller</h2>
              <p className="text-sm text-gray-600">
                Produk yang paling sering terjual di IGD Ponsel dalam beberapa waktu terakhir.
              </p>
            </div>
            <div className="relative -mx-4">
              <div className="overflow-x-auto px-4 pb-2">
                <div className="flex gap-6">
                  {popularProducts && popularProducts.length > 0 ? (
                    popularProducts.map((product) => (
                      <div
                        key={product.id}
                        className="min-w-[240px] max-w-xs bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-200 flex-shrink-0"
                      >
                        <div className="aspect-square bg-gray-100 rounded-t-2xl overflow-hidden">
                          <img
                            src={(product.images && product.images[0]) || '/logo/igd-1.jpg'}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="p-4 space-y-2">
                          <div>
                            <p className="text-xs text-gray-500 font-mono">{product.sku}</p>
                            <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">{product.name}</h3>
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>{product.brand?.name || '-'}</span>
                            <span>{product.category?.name || '-'}</span>
                          </div>
                          <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                            <span className="text-xs text-gray-500">Terjual</span>
                            <span className="text-sm font-bold text-gray-900">
                              {product.totalSold.toLocaleString('id-ID')}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="w-full text-center text-gray-500 text-sm py-8">
                      Data penjualan belum tersedia untuk ditampilkan.
                    </div>
                  )}
                </div>
              </div>
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

        {/* Branch & Contact Information - Enhanced */}
        <section className="py-20 bg-white border-t border-gray-100">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
              <div className="lg:col-span-2">
                <div className="text-left mb-8">
                  <h2 className="text-4xl font-bold text-gray-900 mb-4">Cabang & Jam Operasional</h2>
                  <p className="text-lg text-gray-600 max-w-2xl">
                    Kami melayani Anda setiap hari dari pukul <strong>08.00 – 21.00 WIB</strong> di beberapa cabang berikut:
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">IGD Ponsel Sumbersari</h3>
                        <p className="text-xs text-gray-500">Timoritel Lt.2 – Sumbersari</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 mb-3">
                      Jl. Jawa No.66B (Timortel Lt.2), Sumbersari
                    </p>
                    <p className="text-xs text-gray-500">Buka setiap hari • 08.00 – 21.00 WIB</p>
                    <div className="mt-4 rounded-xl overflow-hidden border border-gray-200">
                      <iframe
                        title="Peta IGD Ponsel Jember"
                        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3949.8124582650657!2d113.716710!3d-8.170632!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2dd695745b026179%3A0xa8960dabfd1a9ddb!2sIGD%20PONSEL%20JEMBER!5e0!3m2!1sid!2sid!4v1731760000000!5m2!1sid!2sid"
                        width="100%"
                        height="200"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      ></iframe>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">IGD Ponsel Kalisat</h3>
                        <p className="text-xs text-gray-500">Depan IGD RSU Kalisat</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 mb-3">
                      Jl. PB. Sudirman No.2, Kalisat
                    </p>
                    <p className="text-xs text-gray-500">Buka setiap hari • 08.00 – 21.00 WIB</p>
                    <div className="mt-4 rounded-xl overflow-hidden border border-gray-200">
                      <iframe
                        title="Peta IGD Ponsel II"
                        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3949.616776895647!2d113.818454!3d-8.134098!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2dd6bfae66f266cf%3A0x5636899b4e7ab959!2sIGD%20PONSEL%20II!5e0!3m2!1sid!2sid!4v1731760000001!5m2!1sid!2sid"
                        width="100%"
                        height="200"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      ></iframe>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 shadow-sm h-full flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Kontak & Media Sosial</h3>
                  <div className="space-y-4 text-sm">
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-primary-600" />
                      <a
                        href="https://wa.me/6285705340555"
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary-600 hover:text-primary-700 font-semibold"
                      >
                        Admin (Fast Response) – Klik untuk WhatsApp
                      </a>
                    </div>
                    <div className="flex items-center gap-3">
                      <Instagram className="w-4 h-4 text-primary-600" />
                      <a
                        href="https://instagram.com/igdponsel"
                        target="_blank"
                        rel="noreferrer"
                        className="text-gray-700 hover:text-primary-700"
                      >
                        @igdponsel
                      </a>
                    </div>
                    <div className="flex items-center gap-3">
                      <Instagram className="w-4 h-4 text-primary-600" />
                      <a
                        href="https://tiktok.com/@igdponsel.id"
                        target="_blank"
                        rel="noreferrer"
                        className="text-gray-700 hover:text-primary-700"
                      >
                        @igdponsel.id (TikTok)
                      </a>
                    </div>
                    <div className="flex items-center gap-3">
                      <Facebook className="w-4 h-4 text-primary-600" />
                      <span className="text-gray-700">
                        Facebook: <span className="font-medium">servicehandphonejember</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Facebook className="w-4 h-4 text-primary-600" />
                      <span className="text-gray-700">
                        Facebook: <span className="font-medium">Timoritel Servis (IGD Ponsel Sumbersari)</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Facebook className="w-4 h-4 text-primary-600" />
                      <span className="text-gray-700">
                        Facebook: <span className="font-medium">Servis HP Kalisat (IGD Ponsel Kalisat)</span>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="pt-4 mt-4 border-t border-gray-200 text-xs text-gray-500">
                  Info lengkap kontak dan cabang juga tersedia di{' '}
                  <a
                    href="https://kontak.link/igdponsel"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary-600 hover:text-primary-700 font-semibold"
                  >
                    kontak.link/igdponsel
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* AI Chatbot */}
        <AIChatbot />

        {/* Footer */}
        <footer className="mt-auto border-t border-gray-200 bg-white">
          <div className="container mx-auto px-4 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <span>© {new Date().getFullYear()} IGD Ponsel.</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
