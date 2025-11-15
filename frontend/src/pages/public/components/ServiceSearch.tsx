import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';

interface ServiceSearchProps {
  onSearch: (serviceNumber: string) => void;
  isLoading?: boolean;
  error?: string;
}

export default function ServiceSearch({ onSearch, isLoading, error }: ServiceSearchProps) {
  const [serviceNumber, setServiceNumber] = useState('');
  const [localError, setLocalError] = useState('');

  const validateServiceNumber = (value: string): boolean => {
    // Format: SRV-YYYYMMDD-XXXXXX
    const pattern = /^SRV-\d{8}-\d{6}$/;
    return pattern.test(value);
  };

  const handleSearch = () => {
    setLocalError('');
    
    if (!serviceNumber.trim()) {
      setLocalError('Please enter a service number');
      return;
    }

    const trimmed = serviceNumber.trim().toUpperCase();
    
    if (!validateServiceNumber(trimmed)) {
      setLocalError('Invalid service number format. Expected: SRV-YYYYMMDD-XXXXXX');
      return;
    }

    onSearch(trimmed);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const displayError = error || localError;

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Enter service number (e.g., SRV-20251115-123456)"
            value={serviceNumber}
            onChange={(e) => {
              setServiceNumber(e.target.value);
              setLocalError('');
            }}
            onKeyPress={handleKeyPress}
            className={`${displayError ? 'border-red-500' : ''}`}
            disabled={isLoading}
          />
          {displayError && (
            <p className="mt-1 text-sm text-red-500">{displayError}</p>
          )}
        </div>
        <button
          onClick={handleSearch}
          disabled={isLoading}
          className="px-6 py-2 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-lg font-semibold hover:from-primary-700 hover:to-primary-600 shadow-lg transition-all disabled:opacity-50 flex items-center justify-center"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </button>
      </div>
      <p className="mt-2 text-xs text-gray-500 text-center">
        Find your service number on your receipt or confirmation email
      </p>
    </div>
  );
}

