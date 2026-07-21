import type { Metadata } from 'next';
import { Bricolage_Grotesque, Schibsted_Grotesk } from 'next/font/google';
import Shell from '@/components/Shell';
import './globals.css';

// Bricolage serves EXACTLY ONE element: the "dishi" wordmark, which per the
// design handoff keeps its original bold sans weight. Headings/dish names/CTAs
// use the Chinese-first serif stack defined as --font-display in globals.css.
//
// That stack used to be pure system fonts ('Songti TC', 'STSong', Georgia,
// serif) to keep zero webfont weight — but 'STSong' is an old, rarely-installed
// font, so on Windows/Android/Linux the stack silently fell through Georgia
// (Latin-only, contributes nothing for CJK) to the bare 'serif' keyword, whose
// actual rendered face is inconsistent across browsers/OS and is what made
// Chinese headings render wrong off Apple devices. Noto Serif TC is now loaded
// as a real, guaranteed-correct web font for the Traditional Chinese glyphs —
// via a direct <link> below, NOT next/font/google: this Next.js version's
// bundled font-data.json only declares a 'latin' subset for Noto Serif TC, so
// next/font's typed subset system can't actually request the CJK glyphs (it
// would silently ship a Chinese-named font with no Chinese characters in it).
// 'Songti TC' still wins for free on Mac/iOS (checked first, skipped instantly
// if absent), so the web font is a safety net, not a replacement.
const wordmark = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-wordmark', weight: ['800'] });
const body = Schibsted_Grotesk({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'dishi.me',
  description: '影相、一滑評分 — Dishi 學識你嘅口味，幫你搵到下一道心頭好。Photograph. Flick. Dishi learns your taste.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant" className={`${wordmark.variable} ${body.variable}`}>
      <head>
        {/* iOS Safari auto-detects number-like text (percentages, fractions like
            "10/18") as phone numbers and renders them as blue tel: links — nothing
            in this app is a phone number. Without this, stat figures (90%, 25, 8,
            10/18) turn blue on iOS regardless of any CSS color rule, since the OS
            wraps them in its own <a> before our styles ever apply. */}
        <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
