import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

export interface LabelCardData {
  barcode: string;
  printedName: string;
  sku: string;
  price: number;
}

export interface LabelCardSettings {
  labelWidthMm: number;
  labelHeightMm: number;
  symbology: string;
  showPrintedName: boolean;
  showPrice: boolean;
  showSku: boolean;
}

const rupiah = (v: number) => new Intl.NumberFormat('id-ID').format(v);

/**
 * S5: one physical label rendered at exact mm size (screen preview + print sheet).
 * Barcode = CODE128 via JsBarcode; QR via qrcode. Barcode value falls back to SKU upstream.
 */
export function LabelCard({ data, settings }: { data: LabelCardData; settings: LabelCardSettings }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [qrHtml, setQrHtml] = useState('');

  useEffect(() => {
    if (settings.symbology === 'QR') {
      QRCode.toString(data.barcode, { type: 'svg', margin: 0, width: 96 })
        .then(setQrHtml)
        .catch(() => setQrHtml(''));
      return;
    }
    if (svgRef.current) {
      try {
        JsBarcode(svgRef.current, data.barcode, {
          format: 'CODE128',
          displayValue: false,
          height: 30,
          width: 1.4,
          margin: 0,
        });
      } catch {
        /* non-encodable value — leave the svg empty */
      }
    }
  }, [data.barcode, settings.symbology]);

  return (
    <div
      className="label-card flex flex-col items-center justify-between bg-white border border-dashed border-gray-300 overflow-hidden text-black"
      style={{
        width: `${settings.labelWidthMm}mm`,
        height: `${settings.labelHeightMm}mm`,
        padding: '1.5mm',
      }}
    >
      <div className="w-full text-center leading-tight truncate" style={{ fontSize: '7pt', fontWeight: 700 }}>
        {settings.showPrintedName ? data.printedName : data.sku}
      </div>
      {settings.showPrice && (
        <div className="leading-none" style={{ fontSize: '8pt', fontWeight: 700 }}>
          Rp {rupiah(data.price)}
        </div>
      )}
      {settings.showSku && (
        <div className="leading-none text-gray-600" style={{ fontSize: '6pt' }}>
          {data.sku}
        </div>
      )}
      <div className="flex items-end justify-center w-full min-h-0">
        {settings.symbology === 'QR' ? (
          <div
            className="label-qr"
            style={{ width: '12mm', height: '12mm' }}
            dangerouslySetInnerHTML={{ __html: qrHtml }}
          />
        ) : (
          <svg ref={svgRef} className="max-w-full" style={{ maxHeight: '12mm' }} />
        )}
      </div>
    </div>
  );
}
