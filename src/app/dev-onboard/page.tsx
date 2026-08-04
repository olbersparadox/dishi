'use client';
// Untracked dev harness (same role as dev-picker): the 迎新 walkthrough is behind
// auth AND only renders for a dish-less fresh account, so this mounts the real
// Onboarding sheet to eyeball its three steps. Not part of the app.
import Onboarding from '@/components/Onboarding';

export default function DevOnboard() {
  return (
    <div className="page" style={{ padding: 24 }}>
      <h1>dev: 迎新 walkthrough</h1>
      <Onboarding onPick={() => console.log('pick')} onSkip={() => console.log('skip')} />
    </div>
  );
}
