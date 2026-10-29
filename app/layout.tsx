import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../src/styles.css';

export const metadata: Metadata = {
  title: 'Bragdoc · Diário de trabalho',
  description: 'Um diário pessoal para acompanhar o trabalho que você realiza.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600&display=swap" rel="stylesheet" />
        <meta name="theme-color" content="#f7f6f1" />
      </head>
      <body>{children}</body>
    </html>
  );
}
