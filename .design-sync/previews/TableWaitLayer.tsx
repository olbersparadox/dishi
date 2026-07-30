import { TableWaitLayer } from 'dishi';

// The layer between "I'm done picking" and the bill. Picking ends by handshake,
// so this is what everyone who tapped early sits looking at.
//
// It is position:fixed over a dimmed menu, so each cell wraps it in a
// transform:translateZ(0) box — that makes the wrapper the containing block for
// fixed descendants, and the layer renders at phone size instead of smearing
// across the whole capture viewport.
const PALETTE: Record<string, string> = {
  u1: '#3B82F6', u2: '#A855F7', u3: '#22C55E', u4: '#F59E0B', u5: '#06B6D4',
};
const colorFor = (id: string) => PALETTE[id] ?? '#3B82F6';

// The full Member shape the session hands down. Only display_name/handle and
// ready_at are read here; the rest travel with it everywhere else.
const member = (user_id: string, name: string, ready: boolean) => ({
  user_id, handle: name.toLowerCase().replace(/\s+/g, ''), display_name: name,
  username_claimed: true, has_profile: true, rating_count: 24,
  ready_at: ready ? '2026-07-30T12:00:00Z' : null,
});

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ transform: 'translateZ(0)', position: 'relative', width: 360, height: 420, overflow: 'hidden' }}>
      {children}
    </div>
  );
}

/** Two people, one still reading the menu. The commonest case, and the one that
 *  shows the layer's whole job: peter is faded because the table is waiting on
 *  exactly him. */
export function TwoPeople() {
  return (
    <Frame>
      <TableWaitLayer
        members={[member('u1', 'Jerry Chu', true), member('u2', 'peter', false)]}
        colorFor={colorFor}
        onKeepPicking={() => {}}
      />
    </Frame>
  );
}

/** Four at the table, two still picking. The roster is what turns "why is this
 *  stuck" into two names someone can look up and ask, so the chop row stays
 *  legible rather than collapsing to a count. */
export function FourAtTable() {
  return (
    <Frame>
      <TableWaitLayer
        members={[
          member('u1', 'Jerry Chu', true),
          member('u2', '陳大文', true),
          member('u3', 'Wing', false),
          member('u4', 'Priya Raman', false),
        ]}
        colorFor={colorFor}
        onKeepPicking={() => {}}
      />
    </Frame>
  );
}

/** One tap from the bill. Worth its own cell because this is the state the
 *  table stares at longest, and the last un-tapped chop is the only thing on
 *  screen still carrying information. */
export function LastOneOut() {
  return (
    <Frame>
      <TableWaitLayer
        members={[
          member('u1', 'Jerry Chu', true),
          member('u2', '陳大文', true),
          member('u3', 'Wing', true),
          member('u4', 'Priya Raman', false),
          member('u5', '李小明', true),
        ]}
        colorFor={colorFor}
        onKeepPicking={() => {}}
      />
    </Frame>
  );
}
