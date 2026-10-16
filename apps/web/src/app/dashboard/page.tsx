import { PlayerDashboardViewer } from '@/components/PlayerDashboardViewer';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Player Performance Identity — Vexora Esports',
  description: 'Verified player performance passport, win rates, podiums, recent match form, and tournament history.',
};

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-[#0A0F1D]">
      <PlayerDashboardViewer />
    </main>
  );
}
