'use client';

import { Authenticator } from '@aws-amplify/ui-react';

// Wraps the app with Authenticator.Provider so useAuthenticator()
// is accessible on any page without needing a local <Authenticator> wrapper.
export default function Providers({ children }: { children: React.ReactNode }) {
  return <Authenticator.Provider>{children}</Authenticator.Provider>;
}
