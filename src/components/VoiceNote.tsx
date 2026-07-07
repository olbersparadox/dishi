'use client';
import { useRef, useState } from 'react';

/**
 * Optional spoken note, transcribed on-device with the Web Speech API (free, no upload).
 * The transcript goes to /api/ratings where an LLM extracts structured attributes.
 * Browsers without SpeechRecognition get a plain text field — same downstream pipeline.
 */
export default function VoiceNote({ onTranscript }: { onTranscript: (t: string) => void }) {
  const [listening, setListening] = useState(false);
  const [text, setText] = useState('');
  const [supported] = useState(
    () => typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
  );
  const recRef = useRef<any>(null);

  function toggle() {
    if (listening) { recRef.current?.stop(); return; }
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      const t = Array.from(e.results).map((r: any) => r[0].transcript).join(' ');
      setText(t);
      onTranscript(t);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  return (
    <div>
      {supported ? (
        <button className={`btn small ${listening ? 'primary' : 'ghost'}`} onClick={toggle}>
          {listening ? '● Listening — tap to stop' : '🎙 Say a quick note (optional)'}
        </button>
      ) : null}
      <input
        className="field"
        style={{ marginTop: 8 }}
        placeholder={supported ? 'or type it — “too salty but loved the char”' : '“too salty but loved the char”'}
        value={text}
        onChange={e => { setText(e.target.value); onTranscript(e.target.value); }}
      />
    </div>
  );
}
