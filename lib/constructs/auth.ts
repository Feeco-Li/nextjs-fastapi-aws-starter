import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export class AuthConstruct extends Construct {
  readonly userPool: cognito.UserPool;
  readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const stackName = cdk.Stack.of(this).stackName;

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${stackName}-users`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.userPoolClient = this.userPool.addClient('WebClient', {
      userPoolClientName: `${stackName}-web-client`,
      generateSecret: false,
      authFlows: {
        userSrp: true,       // ALLOW_USER_SRP_AUTH
        userPassword: true,  // ALLOW_USER_PASSWORD_AUTH
      },
      preventUserExistenceErrors: true,
      accessTokenValidity:  cdk.Duration.minutes(60),
      idTokenValidity:      cdk.Duration.minutes(60),
      refreshTokenValidity: cdk.Duration.days(30),
    });
  }
}
