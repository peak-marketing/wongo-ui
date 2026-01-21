import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import './globals.css';

export const metadata: Metadata = {
  title: '피크마케팅 원고 프로그램',
  description: '원고 생성 및 관리 시스템',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        {children}
        <Toaster 
          position="top-center"
          toastOptions={{
            style: {
              background: '#121821',
              color: '#E6EAF2',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            },
            success: {
              style: {
                background: '#121821',
                color: '#E6EAF2',
                border: '1px solid rgba(34, 197, 94, 0.3)',
              },
            },
            error: {
              style: {
                background: '#121821',
                color: '#E6EAF2',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              },
            },
          }}
        />
      </body>
    </html>
  );
}

