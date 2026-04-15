import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { AuthConstruct } from './auth';
import { DatabaseConstruct } from './database';

interface ApiProps {
  auth: AuthConstruct;
  database: DatabaseConstruct;
  vpc: ec2.Vpc;
}

export class ApiConstruct extends Construct {
  readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);

    const { auth, database, vpc } = props;
    const stackName = cdk.Stack.of(this).stackName;

    // ── Lambda security group ─────────────────────────────────────────────────
    const lambdaSg = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc,
      description: 'Lambda API function - outbound to Aurora on 5432',
    });

    // Allow Lambda to connect to Aurora PostgreSQL
    database.securityGroup.addIngressRule(
      lambdaSg,
      ec2.Port.tcp(5432),
      'Lambda to Aurora PostgreSQL',
    );

    // ── Lambda ────────────────────────────────────────────────────────────────
    const apiFn = new lambda.Function(this, 'ApiFunction', {
      functionName: `${stackName}-api`,
      description: 'FastAPI — stateless, auth handled upstream by API Gateway',
      runtime: lambda.Runtime.PYTHON_3_13,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('.', {
        exclude: [
          'node_modules', 'cdk.out', 'dist',  // Node / CDK artifacts
          '.venv', '__pycache__', '*.pyc',     // Python artifacts
          'bin', 'lib',                         // CDK source
          '.git', '.gitignore',
        ],
        bundling: {
          image: lambda.Runtime.PYTHON_3_13.bundlingImage,
          platform: 'linux/amd64',
          command: [
            'bash', '-c',
            'pip install . -t /asset-output && cp -r handler.py app /asset-output',
          ],
        },
      }),
      timeout: cdk.Duration.seconds(29),
      memorySize: 512,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [lambdaSg],
      environment: {
        ENVIRONMENT: 'production',
        DB_SECRET_ARN: database.cluster.secret!.secretArn,
        DB_HOST: database.cluster.clusterEndpoint.hostname,
        DB_PORT: database.cluster.clusterEndpoint.port.toString(),
        DB_NAME: 'appdb',
      },
    });

    // Grant Lambda read access to the Aurora credentials secret
    database.cluster.secret!.grantRead(apiFn);

    // ── API Gateway ───────────────────────────────────────────────────────────
    const api = new apigwv2.HttpApi(this, 'ApiGateway', {
      apiName: `${stackName}-api`,
      description: 'FastAPI backend — JWT auth delegated to API Gateway',
      corsPreflight: {
        allowOrigins: ['*'],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        allowMethods: [apigwv2.CorsHttpMethod.ANY],
        maxAge: cdk.Duration.seconds(300),
      },
    });

    // ── JWT Authorizer ────────────────────────────────────────────────────────
    const authorizer = new HttpJwtAuthorizer(
      'CognitoAuthorizer',
      auth.userPool.userPoolProviderUrl,
      { jwtAudience: [auth.userPoolClient.userPoolClientId] },
    );

    const integration = new HttpLambdaIntegration('ApiIntegration', apiFn);

    // ── Routes ────────────────────────────────────────────────────────────────
    api.addRoutes({
      path: '/health',
      methods: [apigwv2.HttpMethod.GET],
      integration,
    });

    api.addRoutes({
      path: '/{proxy+}',
      methods: [apigwv2.HttpMethod.OPTIONS],
      integration,
    });

    api.addRoutes({
      path: '/{proxy+}',
      methods: [apigwv2.HttpMethod.ANY],
      integration,
      authorizer,
    });

    this.apiUrl = api.url ?? '';
  }
}
