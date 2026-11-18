import './globals.css';
import 'react-toastify/dist/ReactToastify.css';
import type { Metadata } from 'next';
import { ToastProvider } from '@/components/ToastProvider';

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
    <html lang="en">
      <body className="min-h-full bg-slate-100 text-slate-900 antialiased">
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}
