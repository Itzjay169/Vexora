import { ResultVerificationViewer } from '@/components/ResultVerificationViewer';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Verify Match Result — Vexora Esports',
  description: 'Cryptographic result verification certificate showing SHA-256 seal, evidence hashes, formula version, and tamper-evident guarantees.',
};

export default function VerifyResultPage({ params }: { params: { matchId: string } }) {
  return (
    <main className="min-h-screen bg-[#0A0F1D]">
      <ResultVerificationViewer />
    </main>
  );
}
