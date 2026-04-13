import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import * as apigwv2 from '@aws-cdk/aws-apigatewayv2-alpha';
import { HttpJwtAuthorizer } from '@aws-cdk/aws-apigatewayv2-authorizers-alpha';
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';

export class MainStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ── Cognito ──────────────────────────────────────────────────────────────
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${id}-users`,
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
      removalPolicy: cdk.RemovalPolicy.DESTROY,  // same as DeletionPolicy: Delete in SAM
    });

    const userPoolClient = userPool.addClient('WebClient', {
      userPoolClientName: `${id}-web-client`,
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

    // ── Lambda — FastAPI via Mangum ───────────────────────────────────────────
    //
    // CDK bundles the Lambda package using Docker (same pip install as SAM build).
    // Run `cdk deploy` instead of `sam build && sam deploy` — no separate build step.
    //
    const apiFn = new lambda.Function(this, 'ApiFunction', {
      functionName: `${id}-api`,
      description: 'FastAPI — stateless, auth handled upstream by API Gateway',
      runtime: lambda.Runtime.PYTHON_3_13,
      architecture: lambda.Architecture.ARM_64,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('../backend', {
        bundling: {
          image: lambda.Runtime.PYTHON_3_13.bundlingImage,
          platform: 'linux/arm64',
          command: [
            'bash', '-c',
            // installs deps into /asset-output, then copies source alongside them
            'pip install -r requirements.txt -t /asset-output && cp -au . /asset-output',
          ],
        },
      }),
      timeout: cdk.Duration.seconds(29),
      memorySize: 512,
      environment: {
        ENVIRONMENT: 'dev',
      },
    });

    // ── HTTP API v2 ───────────────────────────────────────────────────────────
    //
    // corsPreflight configures CORS at the API level — cleaner than SAM's
    // CorsConfiguration + manual OPTIONS route workaround.
    //
    const api = new apigwv2.HttpApi(this, 'ApiGateway', {
      apiName: `${id}-api`,
      description: 'FastAPI backend — JWT auth delegated to API Gateway',
      corsPreflight: {
        allowOrigins: ['*'],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        allowMethods: [apigwv2.CorsHttpMethod.ANY],
        maxAge: cdk.Duration.seconds(300),
      },
    });

    // ── JWT Authorizer (Cognito) ──────────────────────────────────────────────
    const authorizer = new HttpJwtAuthorizer(
      'CognitoAuthorizer',
      userPool.userPoolProviderUrl,        // issuer URL — no string interpolation needed
      { jwtAudience: [userPoolClient.userPoolClientId] },
    );

    const integration = new HttpLambdaIntegration('ApiIntegration', apiFn);

    // ── Routes ────────────────────────────────────────────────────────────────

    // Public: health check — no authorizer
    api.addRoutes({
      path: '/health',
      methods: [apigwv2.HttpMethod.GET],
      integration,
    });

    // CORS preflight — OPTIONS must bypass JWT authorizer (same requirement as SAM)
    api.addRoutes({
      path: '/{proxy+}',
      methods: [apigwv2.HttpMethod.OPTIONS],
      integration,
    });

    // Protected: all other routes require a valid Cognito access token
    api.addRoutes({
      path: '/{proxy+}',
      methods: [apigwv2.HttpMethod.ANY],
      integration,
      authorizer,
    });

    // ── Outputs ───────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'UserPoolId', {
      description: 'Cognito User Pool ID',
      value: userPool.userPoolId,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      description: 'Cognito App Client ID (no secret)',
      value: userPoolClient.userPoolClientId,
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      description: 'API Gateway base URL',
      value: api.url ?? '',
    });

    new cdk.CfnOutput(this, 'Region', {
      description: 'Deployment region',
      value: this.region,
    });
  }
}
