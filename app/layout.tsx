import type { Metadata, Viewport } from 'next';
import './globals.css';
import RegisterSw from './register-sw';

export const metadata: Metadata = {
  title: 'D247 Signal',
  description: 'Simple EUR/USD signal check. Manual, on demand, demo only.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'D247 Signal', statusBarStyle: 'default' },
  icons: {
    icon: [{ url: '/favicon.ico' }, { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0A2A4A',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#0A2A4A" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>
        <RegisterSw />
        {children}
      </body>
    </html>
  );
}
