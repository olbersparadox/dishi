-- Applied live 2026-07-31.
--
-- 隨機一人 becomes re-rollable. Owner reversal, same day: the draw used to be kept
-- for the life of the session, on the reasoning that re-tapping would let a table
-- shop for an answer it liked until "random" meant nothing. That is now explicitly
-- not the concern — re-tapping, and arguing about the result, is the point:
-- "any interaction is welcome. If they keep playing it or someone refuse to pay,
-- it's part of the fun. It's not about the rules that matters."
--
-- Why a counter rather than server-side randomness: the draw stays a pure function
-- of (members, seed), which is what lets every phone at the table compute the SAME
-- payer independently and start the reveal animation on the tap instead of after a
-- round trip. The counter is the part that moves, so seed = 'session_id:count'
-- gives a genuinely different answer per tap while keeping both properties.
alter table table_sessions
  add column if not exists pay_draw_count integer not null default 0;

comment on column table_sessions.pay_draw_count is
  'How many times 隨機一人 has been drawn for this session. Seeds the draw (session_id:count) so every re-tap is a genuinely different answer that every phone at the table still computes identically. Owner reversal 2026-07-31: the draw used to be kept for the life of the session.';
