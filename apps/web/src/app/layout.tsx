import React from 'react';

export const metadata = {
  title: 'Vexora | Premier Esports Tournament Ecosystem',
  description: 'Compete in verified tournaments, climb community leaderboards, and experience fair esports.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body style={{ margin: 0, backgroundColor: '#090D16', color: '#F8FAFC', fontFamily: 'Inter, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
