'use client';
import { useEffect, useState } from 'react';

/**
 * Renders the printable QR for one table. The encoded URL is /order/<qr_token> —
 * the token is the secret, so treat the generated image like a key: regenerating
 * the token (Tables tab) invalidates every previously printed copy.
 * Uses the `qrcode` package client-side; nothing leaves the browser.
 */
export default function TableQR({ token, label }: { token: string; label: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const QRCode = (await import('qrcode')).default;
        const url = `${window.location.origin}/order/${token}`;
        const png = await QRCode.toDataURL(url, {
          width: 512,
          margin: 2,
          color: { dark: '#1e2320', light: '#ffffff' },
        });
        if (!cancelled) setDataUrl(png);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (failed) return <p className="card-meta">QR rendering failed — run npm install to add the qrcode package.</p>;
  if (!dataUrl) return <p className="card-meta">Drawing the code…</p>;

  return (
    <div style={{ textAlign: 'center' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dataUrl} alt={`QR code for ${label}`} style={{ width: 180, height: 180, borderRadius: 8 }} />
      <div>
        <a className="btn ghost small" href={dataUrl} download={`dishi-${label.replace(/\s+/g, '-').toLowerCase()}.png`}>
          Download for printing
        </a>
      </div>
    </div>
  );
}
