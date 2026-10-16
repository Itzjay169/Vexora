import React from 'react';
import { OrganiserConsole } from '../../components/OrganiserConsole';

export const metadata = {
  title: 'Organiser Operations Center | Vexora Esports',
  description: 'Control center for verified tournament organisers: manage rosters, room release, match-day protocols, announcements, and incident reporting.',
};

export default function OrganiserPage() {
  return (
    <main style={{ backgroundColor: '#070714', minHeight: '100vh', padding: '20px 0' }}>
      <OrganiserConsole />
    </main>
  );
}
