import { LeaderboardViewer } from '@/components/LeaderboardViewer';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Competitive Leaderboards — Vexora Esports',
  description: 'Official verified player and team standings calculated deterministically using Krafton & Booyah scoring protocols with SHA-256 Merkle root integrity.',
};

export default function LeaderboardPage() {
  return (
    <main className="min-h-screen bg-[#0A0F1D]">
      <LeaderboardViewer />
    </main>
  );
}
