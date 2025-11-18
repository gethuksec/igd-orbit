import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { publicService } from '@/services/public.service';
import type { ServiceTrackingData } from '@/services/public.service';
import ServiceSearch from './components/ServiceSearch';
import StatusTimeline from './components/StatusTimeline';
import ContactSupport from './components/ContactSupport';
import { ArrowLeft, Wrench, Clock, CheckCircle2, AlertCircle, Phone, MapPin, MessageCircle } from 'lucide-react';
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Header with Branding */}
      <header className="bg-gradient-to-r from-[#b9051f] via-[#e11b22] to-[#b9051f] text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                title="Kembali ke Beranda"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                  <Wrench className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold">Lacak Status Service</h1>
                  <p className="text-red-100 text-sm mt-1">IGD Ponsel Service Center</p>
                </div>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2 text-sm text-red-100">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-green-300 animate-pulse" />
                <span>Buka setiap hari 08.00 – 21.00 WIB</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Search Section - Enhanced */}
        <div className="mb-8">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 md:p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                Cari Status Service Anda
              </h2>
              <p className="text-gray-600">
                Masukkan nomor service yang tertera pada nota servis / invoice Anda
              </p>
            </div>
            <ServiceSearch
              onSearch={handleSearch}
              isLoading={isLoading}
              error={error ? 'Service tidak ditemukan. Silakan periksa nomor service Anda.' : undefined}
            />
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
            <p className="text-gray-600 font-medium">Memuat informasi service...</p>
            <p className="text-sm text-gray-500 mt-2">Mohon tunggu sebentar</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && searchServiceNumber && (
          <div className="bg-white rounded-2xl shadow-xl border border-red-200 p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Service Tidak Ditemukan</h3>
            <p className="text-red-600 font-medium mb-2">
              Nomor service <strong>{searchServiceNumber}</strong> tidak ditemukan dalam sistem.
            </p>
            <p className="text-gray-600 text-sm mb-4">
              Silakan periksa kembali nomor service yang Anda masukkan. Nomor service biasanya tercetak di nota servis atau invoice Anda.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => {
                  setSearchServiceNumber('');
                  navigate('/track');
                }}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
              >
                Cari Lagi
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                Kembali ke Beranda
              </button>
            </div>
          </div>
        )}

        {/* Service Data Display */}
        {serviceData && !isLoading && (
          <div className="space-y-6">
            {/* Service Info Card - Enhanced */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-primary-600 to-primary-500 p-6 text-white">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <p className="text-sm text-red-100 mb-1">Nomor Service</p>
                    <h2 className="text-3xl font-bold">{serviceData.serviceNumber}</h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        <span className="text-sm font-medium">
                          {serviceData.receivedDate
                            ? new Date(serviceData.receivedDate).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {/* Device Information */}
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-primary-600" />
                    Informasi Perangkat
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-1">Jenis Perangkat</p>
                      <p className="text-sm font-semibold text-gray-900 capitalize">
                        {serviceData.deviceType || '-'}
                      </p>
                    </div>
                    {serviceData.deviceBrand && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-xs text-gray-500 mb-1">Merek</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {serviceData.deviceBrand}
                        </p>
                      </div>
                    )}
                    {serviceData.deviceModel && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-xs text-gray-500 mb-1">Model</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {serviceData.deviceModel}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Timeline Information */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary-600" />
                    Timeline Service
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 bg-blue-50 rounded-lg p-4">
                      <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">Tanggal Diterima</p>
                        <p className="text-xs text-gray-600">
                          {serviceData.receivedDate
                            ? new Date(serviceData.receivedDate).toLocaleDateString('id-ID', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
                        </p>
                      </div>
                    </div>
                    {serviceData.promisedDate && (
                      <div className="flex items-center gap-3 bg-yellow-50 rounded-lg p-4">
                        <div className="flex-shrink-0 w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                          <Clock className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900">Estimasi Selesai</p>
                          <p className="text-xs text-gray-600">
                            {new Date(serviceData.promisedDate).toLocaleDateString('id-ID', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                    )}
                    {serviceData.estimatedCompletion && (
                      <div className="flex items-center gap-3 bg-green-50 rounded-lg p-4">
                        <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900">Perkiraan Penyelesaian</p>
                          <p className="text-xs text-gray-600">
                            {new Date(serviceData.estimatedCompletion).toLocaleDateString('id-ID', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Status Timeline */}
            <StatusTimeline
              currentStatus={serviceData.status}
              statusHistory={serviceData.statusHistory}
            />

            {/* Contact Support - Enhanced */}
            <div className="bg-gradient-to-br from-primary-50 to-red-50 rounded-2xl shadow-xl border border-primary-100 p-6 md:p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                <MessageCircle className="w-6 h-6 text-primary-600" />
                Butuh Bantuan?
              </h3>
              <p className="text-gray-600 mb-6">
                Jika Anda memiliki pertanyaan atau membutuhkan informasi lebih lanjut tentang service Anda, silakan hubungi kami melalui salah satu cara di bawah ini.
              </p>
              <ContactSupport />
            </div>

            {/* Additional Info */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Informasi Penting</h3>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p>
                    <strong className="text-gray-900">Service Bergaransi:</strong> Semua perbaikan yang dilakukan di IGD Ponsel dilengkapi dengan garansi sesuai dengan jenis perbaikan.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p>
                    <strong className="text-gray-900">Pengambilan Service:</strong> Pastikan untuk membawa nota servis atau identitas diri saat mengambil perangkat yang sudah diperbaiki.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p>
                    <strong className="text-gray-900">Jam Operasional:</strong> Kami melayani setiap hari mulai pukul 08.00 hingga 21.00 WIB.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!searchServiceNumber && !isLoading && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-12 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-100 rounded-full mb-6">
              <Wrench className="w-10 h-10 text-primary-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Lacak Status Service Anda</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Masukkan nomor service di atas untuk melihat status perbaikan perangkat Anda secara real-time.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span>Jember & Kalisat</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>08.00 - 21.00 WIB</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <span>Hubungi Kami</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
