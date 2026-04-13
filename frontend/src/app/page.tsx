'use client';

/**
 * Public home page — shows the Amplify Authenticator UI.
 *
 * The <Authenticator> component provides sign-in, sign-up, and forgot-password
 * flows out of the box. No custom auth UI is needed.
 * Once signed in, the user is redirected to /dashboard.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';

function RedirectWhenSignedIn() {
  const { user } = useAuthenticator((ctx) => [ctx.user]);
  const router = useRouter();

  useEffect(() => {
    if (user) router.replace('/dashboard');
  }, [user, router]);

  return null;
}

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            NextJS + FastAPI Template
          </h1>
          <p className="mt-2 text-gray-500">
            Powered by Amazon Cognito &amp; Amplify
          </p>
        </div>

        {/*
          Authenticator renders the sign-in / sign-up / forgot-password UI.
          Its children are only shown once the user is authenticated —
          RedirectWhenSignedIn then sends them to /dashboard.
        */}
        <Authenticator>
          <RedirectWhenSignedIn />
        </Authenticator>
      </div>
    </main>
  );
}
