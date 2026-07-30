import { TableQR } from 'dishi';

// The owner's Tables tab: one printable QR per physical table, shown only
// once "Show QR" is tapped (owner/page.tsx). token is the secret half of
// /order/<token> — regenerating it invalidates every printed copy, so these
// are plausible tokens, not the word "test".

/** A single named table. */
export function Default() {
  return <TableQR token="qr_7hN2pLk9wR4x" label="Table 3" />;
}

/** A different physical spot, same shape — the variant axis here is really
 *  just the printed label under the code. */
export function PatioTable() {
  return <TableQR token="qr_3mVb8sQe1zTa" label="Patio A" />;
}
