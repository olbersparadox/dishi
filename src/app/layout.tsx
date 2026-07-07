import type { Metadata } from 'next';
import { Bricolage_Grotesque, Schibsted_Grotesk } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', weight: ['600', '700', '800'] });
const body = Schibsted_Grotesk({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'Dishi — eat closer',
  description: 'Photograph. Flick. Dishi learns your taste and finds your next favorite dish.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <div className="shell">
          <header className="topbar">
            <div>
              <div className="wordmark">dish<em>i</em></div>
              <div className="tagline">eat closer&ensp;·&ensp;食得近d</div>
            </div>
          </header>
          {children}
        </div>
        <nav className="tabbar" aria-label="Main">
          <Link href="/">For you</Link>
          <Link href="/scan">Scan</Link>
          <Link href="/log" className="log">+ Log</Link>
          <Link href="/table">Table</Link>
          <Link href="/profile">Taste</Link>
        </nav>
      </body>
    </html>
  );
}
