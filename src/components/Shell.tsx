'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LanguageProvider, useLang } from '@/lib/i18n';

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <ShellInner>{children}</ShellInner>
    </LanguageProvider>
  );
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const { lang, setLang, t } = useLang();
  const path = usePathname();

  return (
    <>
      <div className="shell">
        <header className="topbar">
          <div>
            <div className="wordmark">dish<em>i</em></div>
            <div className="tagline">{t('tagline')}</div>
          </div>
          <div className="lang-toggle" role="group" aria-label="Language / 語言">
            <button className={lang === 'zh' ? 'on' : ''} onClick={() => setLang('zh')} aria-pressed={lang === 'zh'}>中</button>
            <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')} aria-pressed={lang === 'en'}>EN</button>
          </div>
        </header>
        {children}
      </div>
      <nav className="tabbar" aria-label="Main">
        <Link href="/" className={path === '/' ? 'active' : ''}>{t('nav.foryou')}</Link>
        <Link href="/scan" className={path === '/scan' ? 'active' : ''}>{t('nav.scan')}</Link>
        <Link href="/log" className="log">{t('nav.log')}</Link>
        <Link href="/table" className={path === '/table' ? 'active' : ''}>{t('nav.table')}</Link>
        <Link href="/profile" className={path === '/profile' ? 'active' : ''}>{t('nav.taste')}</Link>
      </nav>
    </>
  );
}
