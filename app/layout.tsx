import React from 'react';
import './globals.css';

export const metadata = {
  title: 'VaultOne - Encrypted Digital Vault & Command Center',
  description: 'Two-layer zero-knowledge personal digital vault with 5-second auto-lock.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
