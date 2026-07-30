import { DailyInteractions } from 'dishi';

// DailyInteractions owns its data: it reads /api/interactions/today through
// useInteractions and renders NOTHING when the feed is empty (an empty prompt
// strip must not leave chrome behind). To show it at all, this preview answers
// that one URL with a realistic feed — the mock intercepts ONLY
// /api/interactions/today and passes every other request through untouched.

const photo = (table: string, food: string, garnish: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120" viewBox="0 0 160 120">` +
    `<rect width="160" height="120" fill="${table}"/>` +
    `<ellipse cx="80" cy="64" rx="56" ry="42" fill="#f4efe6"/>` +
    `<ellipse cx="80" cy="62" rx="42" ry="30" fill="${food}"/>` +
    `<ellipse cx="66" cy="54" rx="12" ry="7" fill="${garnish}" opacity="0.85"/>` +
    `</svg>`,
  )}`;

const FEED = {
  interactions: [
    {
      kind: 'duel',
      rematch: false,
      duel: {
        id: 'duel-1',
        a: {
          id: 'd-cf1', name: 'Beef Chow Fun', name_zh: '乾炒牛河',
          photo_url: photo('#5c4433', '#a9672f', '#d8b25a'), restaurant: '新記茶餐廳',
        },
        b: {
          id: 'd-sq1', name: 'Salt and Pepper Squid', name_zh: '椒鹽鮮魷',
          photo_url: photo('#4d3a2e', '#d9a441', '#7fa15a'), restaurant: '金華冰廳',
        },
      },
    },
    {
      kind: 'execution',
      rows: [
        {
          dish: {
            id: 'd-cf2', name: 'Beef Chow Fun', name_zh: '乾炒牛河',
            photo_url: photo('#4d3a2e', '#b3773b', '#c9a44e'),
            restaurant: '金華冰廳', restaurant_id: 'r-kamwah',
          },
          min: 5, max: 10, value: 7, verdictScore: 0.6,
        },
        {
          dish: {
            id: 'd-cf3', name: 'Beef Chow Fun', name_zh: '乾炒牛河',
            photo_url: photo('#5c4433', '#a9672f', '#d8b25a'),
            restaurant: '新記茶餐廳', restaurant_id: 'r-sunkee',
          },
          min: 5, max: 10, value: null, verdictScore: 0.35,
        },
      ],
    },
  ],
};

if (typeof window !== 'undefined') {
  const realFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/api/interactions/today')) {
      return Promise.resolve(new Response(JSON.stringify(FEED), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }));
    }
    return realFetch(input, init);
  }) as typeof window.fetch;
}

/** The 今日 strip at the top of the 食記 journal: at most two pending
 *  comparisons (a duel and an execution ask here), one outline card, no
 *  heading. Tapping a row opens the shared comparison overlay; when nothing is
 *  waiting the component renders nothing at all. */
export function JournalTodayStrip() {
  return (
    <div style={{ width: 380 }}>
      <DailyInteractions />
    </div>
  );
}
