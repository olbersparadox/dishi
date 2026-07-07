import type { Metadata } from 'next';
import { Bricolage_Grotesque, Schibsted_Grotesk } from 'next/font/google';
<<<<<<< HEAD
import Shell from '@/components/Shell';
import './globals.css';

// Latin display/body fonts; CJK text falls through to the system stack
// (PingFang TC on Apple, Microsoft JhengHei on Windows) — crisp Traditional
// Chinese with zero webfont weight.
=======
import Link from 'next/link';
import './globals.css';

>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', weight: ['600', '700', '800'] });
const body = Schibsted_Grotesk({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
<<<<<<< HEAD
  title: 'Dishi — 食得近d',
  description: '影相、一滑評分 — Dishi 學識你嘅口味，幫你搵到下一道心頭好。Photograph. Flick. Dishi learns your taste.',
=======
  title: 'Dishi — eat closer',
  description: 'Photograph. Flick. Dishi learns your taste and finds your next favorite dish.',
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
<<<<<<< HEAD
    <html lang="zh-Hant" className={`${display.variable} ${body.variable}`}>
      <body>
        <Shell>{children}</Shell>
=======
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
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
      </body>
    </html>
  );
}
