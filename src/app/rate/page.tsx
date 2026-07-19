'use client';
import AuthGate from '@/components/AuthGate';
import RatingStack from '@/components/RatingStack';

// The album-batch rating flow. Reached from the Taste-AI photo entry after a
// multi-select; the photos ride in via the pendingPhoto hand-off.
export default function RatePage() {
  return (
    <AuthGate>
      <RatingStack />
    </AuthGate>
  );
}
