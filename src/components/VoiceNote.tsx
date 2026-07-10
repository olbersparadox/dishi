'use client';
import { useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';

/**
 * Optional spoken note, transcribed on-device with the Web Speech API (free, no upload).
 * The transcript goes to /api/ratings where an LLM extracts structured attributes.
 * Browsers without SpeechRecognition get a plain text field — same downstream pipeline.
 *
 * Previously any failure here was silent: no onerror handler, no try/catch around
 * start(), so a denied mic permission, an unsupported locale, or the in-app-browser
 * restrictions several iOS/Android browsers impose would leave the button reading
 * "Listening" forever with nothing actually happening and no way to tell why. Every
 * real failure now surfaces an honest, translated reason and falls back to the text
 * field, which always keeps working regardless of what the mic does.
 */
export default function VoiceNote({ onTranscript }: { onTranscript: (t: string) => void }) {
  const { t, lang } = useLang();
  const [listening, setListening] = useState(false);
  const [text, setText] = useState('');
  const [micError, setMicError] = useState<string | null>(null);
  const [supported] = useState(
    () => typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
  );
  const recRef = useRef<any>(null);
  // yue-Hant-HK (Cantonese) has genuinely spotty support across browsers/OSes —
  // some recognize it fine, some silently fail to even start, some only know the
  // broader zh-HK locale. Track whether we've already tried the narrower one so a
  // failure can retry once with the broader fallback before giving up for real.
  const triedNarrowLocale = useRef(false);

  function startRecognition(localeTag: string) {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = localeTag;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      const transcript = Array.from(e.results).map((r: any) => r[0].transcript).join(' ');
      setText(transcript);
      onTranscript(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = (e: any) => {
      // "language-not-supported" is exactly the case a broader locale might rescue —
      // try zh-HK once before surfacing an error, instead of giving up on the first
      // sign that the narrow Cantonese tag isn't recognized on this device.
      if (e.error === 'language-not-supported' && localeTag === 'yue-Hant-HK' && !triedNarrowLocale.current) {
        triedNarrowLocale.current = true;
        try { startRecognition('zh-HK'); return; } catch { /* fall through to error below */ }
      }
      setListening(false);
      setMicError(
        e.error === 'not-allowed' || e.error === 'service-not-allowed' ? t('voice.err.permission')
        : e.error === 'language-not-supported' ? t('voice.err.language')
        : e.error === 'no-speech' ? t('voice.err.nospeech')
        : t('voice.err.generic'),
      );
    };
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  function toggle() {
    if (listening) { recRef.current?.stop(); return; }
    setMicError(null);
    triedNarrowLocale.current = false;
    try {
      startRecognition(lang === 'zh' ? 'yue-Hant-HK' : 'en-US');
    } catch {
      // Some browsers throw synchronously on construction/start (e.g. genuinely no
      // speech service registered) rather than firing onerror — same honest
      // message and fallback either way.
      setListening(false);
      setMicError(t('voice.err.generic'));
    }
  }

  return (
    <div>
      {supported ? (
        <button className={`btn small ${listening ? 'primary' : 'ghost'}`} onClick={toggle}>
          {listening ? t('voice.listening') : t('voice.start')}
        </button>
      ) : null}
      {micError && <p className="card-meta" style={{ marginTop: 4, color: 'var(--lacquer)' }}>{micError}</p>}
      <input
        className="field"
        style={{ marginTop: 8 }}
        placeholder={supported ? t('voice.type') : t('voice.typeonly')}
        value={text}
        onChange={e => { setText(e.target.value); onTranscript(e.target.value); }}
      />
    </div>
  );
}
