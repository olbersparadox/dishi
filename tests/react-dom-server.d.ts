// react-dom ships no bundled types for the server entry in this project's
// dependency set, and @types/react-dom currently peer-conflicts with the
// installed react-dom version (npm eresolve). The tests only need
// renderToStaticMarkup, typed here exactly, so bare `npx tsc --noEmit` stays
// clean per the repo's verification rule.
declare module 'react-dom/server' {
  import type { ReactElement } from 'react';
  export function renderToStaticMarkup(element: ReactElement): string;
}
