'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LanguageProvider, useLang } from '@/lib/i18n';
import { TranslationProvider } from '@/lib/translation';
import { ScanPresetProvider } from '@/lib/scanPreset';
import { ScanMenuIcon } from './icons';
import NotificationBell from './NotificationBell';
import LanguagePicker from './LanguagePicker';

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <TranslationProvider>
        {/* ScanPresetProvider spans both the header globe and the page below it,
            so a scan's foreign-menu preset and an explicit override in the globe
            stay in sync. Shell is the persistent root layout, so this survives
            tab switches and dies on refresh — matching scanSession's lifetime. */}
        <ScanPresetProvider>
          <ShellInner>{children}</ShellInner>
        </ScanPresetProvider>
      </TranslationProvider>
    </LanguageProvider>
  );
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const { lang, t } = useLang();
  const path = usePathname();

  return (
    <div className={`app-root lang-${lang}`}>
      <div className="shell">
        {/* Handoff header: wordmark + language toggle only, center-aligned — the
            tagline line was dropped in the decided design (quiet header, the
            wordmark carries it). */}
        <header className="topbar">
          <div className="wordmark">dish<em>i</em></div>
          <div className="topbar-right">
            {/* Always-visible notification bell, then the globe language-pair picker. */}
            <NotificationBell />
            <LanguagePicker />
          </div>
        </header>
        {children}
      </div>
      {/* Three tabs: Feed (left, today shows the same recommendations/rated-dishes
          content as before under a new position/label — becomes the real social
          feed once that ships) / Scan (center, raised — the app's core loop) /
          Taste (right, absorbs what was the standalone Profile page). Table and
          the standalone +Log button are no longer separate tabs: joining a table
          now lives on Scan's capture screen, and logging a dish by photo is
          reachable from Taste — see the entry point added there. */}
      <nav className="tabbar" aria-label="Main">
        <Link href="/" className={`tabbar-side ${path === '/' ? 'active' : ''}`}>{t('nav.feed')}</Link>
        <Link href="/scan" className={`tabbar-scan ${path === '/scan' ? 'active' : ''}`} aria-label={t('nav.scan')}>
          <ScanMenuIcon size={26} />
        </Link>
        <Link href="/profile" className={`tabbar-side ${path === '/profile' ? 'active' : ''}`}>{t('nav.taste')}</Link>
      </nav>
    </div>
  );
}

