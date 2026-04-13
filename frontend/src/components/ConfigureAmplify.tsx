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

// No { ssr: true } — static export has no server; tokens live in localStorage
Amplify.configure(amplifyConfig);

export default function ConfigureAmplify() {
  return null;
}
