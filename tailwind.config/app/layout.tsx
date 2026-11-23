import React from 'react';
import './globals.css';

export const metadata = {
  title: 'VaultOne - Personal Digital Vault & Command Center',
  description: 'One secure place for your digital life, student journey, and experiments.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, backgroundColor: '#020617', color: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}