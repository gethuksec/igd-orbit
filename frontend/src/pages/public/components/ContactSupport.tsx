import { Button } from '@/components/ui/button';
import { Phone, MessageCircle, MapPin } from 'lucide-react';

interface ContactSupportProps {
  branchPhone?: string;
  branchAddress?: string;
  branchName?: string;
}

export default function ContactSupport({
  branchPhone,
  branchAddress,
  branchName,
}: ContactSupportProps) {
  const handleWhatsApp = () => {
    const message = encodeURIComponent(
      `Hello, I need help with my service order. Service Number: [Please provide]`,
    );
    const phoneNumber = branchPhone?.replace(/[^0-9]/g, '') || '6281234567890';
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
  };

  const handlePhoneCall = () => {
    if (branchPhone) {
      window.location.href = `tel:${branchPhone}`;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">Need Help?</h3>
      <div className="space-y-3">
        <Button
          onClick={handleWhatsApp}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          <MessageCircle className="w-4 h-4 mr-2" />
          Chat via WhatsApp
        </Button>
        {branchPhone && (
          <Button
            onClick={handlePhoneCall}
            variant="outline"
            className="w-full"
          >
            <Phone className="w-4 h-4 mr-2" />
            Call: {branchPhone}
          </Button>
        )}
        {branchAddress && (
          <div className="pt-3 border-t">
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4 mt-0.5" />
              <div>
                <div className="font-medium">{branchName || 'Branch'}</div>
                <div>{branchAddress}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

