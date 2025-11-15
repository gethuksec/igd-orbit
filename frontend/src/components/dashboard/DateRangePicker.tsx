import { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { format, startOfToday, subDays, startOfMonth, subMonths } from 'date-fns';
import { id } from 'date-fns/locale';

type DateRange = {
  startDate: Date;
  endDate: Date;
};

type PresetRange = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'custom';

interface DateRangePickerProps {
  onRangeChange: (range: DateRange) => void;
  defaultRange?: PresetRange;
}

export function DateRangePicker({ onRangeChange, defaultRange = 'today' }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<PresetRange>(defaultRange);
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  const getPresetRange = (preset: PresetRange): DateRange => {
    const today = startOfToday();
    switch (preset) {
      case 'today':
        return { startDate: today, endDate: today };
      case 'yesterday':
        return { startDate: subDays(today, 1), endDate: subDays(today, 1) };
      case 'last7days':
        return { startDate: subDays(today, 6), endDate: today };
      case 'last30days':
        return { startDate: subDays(today, 29), endDate: today };
      case 'thisMonth':
        return { startDate: startOfMonth(today), endDate: today };
      case 'lastMonth':
        const lastMonth = subMonths(today, 1);
        return { startDate: startOfMonth(lastMonth), endDate: startOfMonth(today) };
      default:
        return { startDate: today, endDate: today };
    }
  };

  const handlePresetSelect = (preset: PresetRange) => {
    setSelectedPreset(preset);
    if (preset !== 'custom') {
      onRangeChange(getPresetRange(preset));
      setIsOpen(false);
    }
  };

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      onRangeChange({
        startDate: new Date(customStart),
        endDate: new Date(customEnd),
      });
      setIsOpen(false);
    }
  };

  const currentRange = getPresetRange(selectedPreset);
  const displayText =
    selectedPreset === 'custom' && customStart && customEnd
      ? `${format(new Date(customStart), 'dd MMM yyyy', { locale: id })} - ${format(new Date(customEnd), 'dd MMM yyyy', { locale: id })}`
      : selectedPreset === 'custom'
        ? 'Pilih Tanggal'
        : format(currentRange.startDate, 'dd MMM yyyy', { locale: id }) === format(currentRange.endDate, 'dd MMM yyyy', { locale: id })
          ? format(currentRange.startDate, 'dd MMM yyyy', { locale: id })
          : `${format(currentRange.startDate, 'dd MMM yyyy', { locale: id })} - ${format(currentRange.endDate, 'dd MMM yyyy', { locale: id })}`;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indonesia-red-500"
      >
        <Calendar className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium">{displayText}</span>
        <ChevronDown className="w-4 h-4 text-gray-500" />
      </button>

      {isOpen && (
        <>
          <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 z-50 min-w-[280px]">
            <div className="p-2">
              <button
                onClick={() => handlePresetSelect('today')}
                className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm ${
                  selectedPreset === 'today' ? 'bg-indonesia-red-50 text-indonesia-red-700' : ''
                }`}
              >
                Hari Ini
              </button>
              <button
                onClick={() => handlePresetSelect('yesterday')}
                className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm ${
                  selectedPreset === 'yesterday' ? 'bg-indonesia-red-50 text-indonesia-red-700' : ''
                }`}
              >
                Kemarin
              </button>
              <button
                onClick={() => handlePresetSelect('last7days')}
                className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm ${
                  selectedPreset === 'last7days' ? 'bg-indonesia-red-50 text-indonesia-red-700' : ''
                }`}
              >
                7 Hari Terakhir
              </button>
              <button
                onClick={() => handlePresetSelect('last30days')}
                className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm ${
                  selectedPreset === 'last30days' ? 'bg-indonesia-red-50 text-indonesia-red-700' : ''
                }`}
              >
                30 Hari Terakhir
              </button>
              <button
                onClick={() => handlePresetSelect('thisMonth')}
                className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm ${
                  selectedPreset === 'thisMonth' ? 'bg-indonesia-red-50 text-indonesia-red-700' : ''
                }`}
              >
                Bulan Ini
              </button>
              <button
                onClick={() => handlePresetSelect('lastMonth')}
                className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm ${
                  selectedPreset === 'lastMonth' ? 'bg-indonesia-red-50 text-indonesia-red-700' : ''
                }`}
              >
                Bulan Lalu
              </button>
              <button
                onClick={() => handlePresetSelect('custom')}
                className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm ${
                  selectedPreset === 'custom' ? 'bg-indonesia-red-50 text-indonesia-red-700' : ''
                }`}
              >
                Kustom
              </button>
            </div>

            {selectedPreset === 'custom' && (
              <div className="p-4 border-t border-gray-200">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tanggal Mulai
                    </label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indonesia-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tanggal Akhir
                    </label>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indonesia-red-500"
                    />
                  </div>
                  <button
                    onClick={handleCustomApply}
                    disabled={!customStart || !customEnd}
                    className="w-full bg-indonesia-red-600 hover:bg-indonesia-red-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Terapkan
                  </button>
                </div>
              </div>
            )}
          </div>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
        </>
      )}
    </div>
  );
}

