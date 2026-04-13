'use client';

/**
 * Initialises Amplify once on the client side.
 * Import this component in the root layout — it renders nothing.
 *
 * { ssr: true } stores tokens in cookies instead of localStorage,
 * which enables server-side session reads if needed later.
 */
import { Amplify } from 'aws-amplify';
import amplifyConfig from '@/lib/amplify-config';

// { ssr: true } stores tokens in cookies instead of localStorage,
// enabling server-side session reads in middleware and Server Components.
Amplify.configure(amplifyConfig, { ssr: true });

export default function ConfigureAmplify() {
  return null;
}
