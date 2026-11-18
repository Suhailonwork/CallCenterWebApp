import './globals.css';
import 'react-toastify/dist/ReactToastify.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ToastProvider } from '@/components/ToastProvider';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'SSS Communications',
  description: 'SSS Communications call center',
  icons: {
    icon: '/sss-logo.webp',
    shortcut: '/sss-logo.webp',
    apple: '/sss-logo.webp',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-full bg-slate-100 font-sans text-slate-900 antialiased">
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}
