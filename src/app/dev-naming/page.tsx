'use client';
// Untracked dev harness (same role as dev-picker / dev-onboard): 待評菜式 is
// behind auth and needs a live shared table, so this mounts the REAL PickCard to
// eyeball the shared-table row added after the 2026-08-03 field session.
// Not part of the app.
//
// The rows are the actual VRBSS session: Jerry picked 魚湯海斑米線, Wool picked
// 瑤柱蛋白炒米粉, both ate both, and the bill split evenly over the two.
import PickCard from '@/components/PickCard';

export default function DevPickCards() {
  return (
    <div className="page" style={{ padding: 16 }}>
      <h3 style={{ marginBottom: 2 }}>待評菜式</h3>
      <PickCard
        dish={{
          id: '1', name: 'Egg white stir-fried with rice vermicelli', name_zh: '瑤柱蛋白炒米粉',
          source: 'table', restaurant: null, photo_url: null, mine: false, picked_by: 'Wool',
        }}
        sealed={false} uploading={false}
        onAddPhoto={() => {}} onRate={() => console.log('rate')} onDelete={() => {}}
      />
      <PickCard
        dish={{
          id: '2', name: 'Fish soup with sea cucumber and rice vermicelli', name_zh: '魚湯海斑米線',
          source: 'scan', restaurant: null, photo_url: null, mine: true, picked_by: null,
        }}
        sealed
        uploading={false}
        onAddPhoto={() => {}} onRate={() => console.log('rate')} onDelete={() => {}}
      />
      <PickCard
        dish={{
          id: '3', name: 'Steamed pork patty', name_zh: '冬菇馬蹄蒸肉餅',
          source: 'home', restaurant: null, photo_url: null, mine: true, picked_by: null,
        }}
        sealed={false} uploading={false}
        onAddPhoto={() => {}} onRate={() => console.log('rate')} onDelete={() => {}}
      />
    </div>
  );
}
