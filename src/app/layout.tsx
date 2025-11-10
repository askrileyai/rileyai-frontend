import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RileyAI - AI-Powered Trading Assistant',
  description: 'Your intelligent trading companion for real-time market analysis, strategy development, and portfolio management.',
  keywords: ['trading', 'AI', 'stock market', 'portfolio', 'investment', 'analysis'],
  authors: [{ name: 'RileyAI' }],
  openGraph: {
    title: 'RileyAI - AI-Powered Trading Assistant',
    description: 'Your intelligent trading companion for real-time market analysis.',
    type: 'website',
    url: 'https://askrileyai.com',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
