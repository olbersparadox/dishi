import type { Metadata } from 'next';
import { Bricolage_Grotesque, Schibsted_Grotesk } from 'next/font/google';
import Shell from '@/components/Shell';
import './globals.css';

// Latin display/body fonts; CJK text falls through to the system stack
// (PingFang TC on Apple, Microsoft JhengHei on Windows) — crisp Traditional
// Chinese with zero webfont weight.
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', weight: ['600', '700', '800'] });
const body = Schibsted_Grotesk({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'Dishi — 食得近d',
  description: '影相、一滑評分 — Dishi 學識你嘅口味，幫你搵到下一道心頭好。Photograph. Flick. Dishi learns your taste.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant" className={`${display.variable} ${body.variable}`}>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
