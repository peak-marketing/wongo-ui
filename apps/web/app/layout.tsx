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
              background: '#FFFFFF',
              color: '#191F28',
              border: '1px solid #E5E8EB',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
              fontSize: '14px',
              fontWeight: 500,
              padding: '12px 16px',
            },
            success: {
              style: {
                background: '#FFFFFF',
                color: '#191F28',
                border: '1px solid #34C759',
              },
              iconTheme: { primary: '#34C759', secondary: '#FFFFFF' },
            },
            error: {
              style: {
                background: '#FFFFFF',
                color: '#191F28',
                border: '1px solid #FF3B30',
              },
              iconTheme: { primary: '#FF3B30', secondary: '#FFFFFF' },
            },
          }}
        />
      </body>
    </html>
  );
}

