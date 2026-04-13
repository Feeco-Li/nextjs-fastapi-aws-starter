import type { Metadata } from 'next';
import '@aws-amplify/ui-react/styles.css';
import './globals.css';
import ConfigureAmplify from '@/components/ConfigureAmplify';
import Providers from '@/components/Providers';

export const metadata: Metadata = {
  title: 'NextJS + FastAPI Template',
  description: 'Next.js + FastAPI + Cognito on AWS',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ConfigureAmplify />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
