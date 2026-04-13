import type { ResourcesConfig } from 'aws-amplify';

/**
 * Amplify configuration — values come from environment variables set by
 * scripts/post-deploy.sh (local) or Amplify Console (hosted).
 *
 * Never hard-code Pool IDs here — keep them in env vars so the same
 * codebase can target dev / staging / prod stacks without code changes.
 */
const amplifyConfig: ResourcesConfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID!,
      userPoolClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID!,
      loginWith: {
        email: true,
      },
    },
  },
};

export default amplifyConfig;
