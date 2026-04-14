import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AuthConstruct } from './constructs/auth';
import { DatabaseConstruct } from './constructs/database';
import { ApiConstruct } from './constructs/api';

export class MainStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const auth     = new AuthConstruct(this, 'Auth');
    const database = new DatabaseConstruct(this, 'Database');
    const api      = new ApiConstruct(this, 'Api', { auth, database });

    // ── Outputs ───────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'UserPoolId', {
      description: 'Cognito User Pool ID  →  NEXT_PUBLIC_USER_POOL_ID',
      value: auth.userPool.userPoolId,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      description: 'Cognito App Client ID  →  NEXT_PUBLIC_USER_POOL_CLIENT_ID',
      value: auth.userPoolClient.userPoolClientId,
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      description: 'API Gateway base URL  →  NEXT_PUBLIC_API_URL',
      value: api.apiUrl,
    });

    new cdk.CfnOutput(this, 'Region', {
      description: 'Deployment region  →  NEXT_PUBLIC_AWS_REGION',
      value: this.region,
    });
  }
}
