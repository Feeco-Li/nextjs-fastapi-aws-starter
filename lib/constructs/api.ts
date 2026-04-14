import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { AuthConstruct } from './auth';
import { DatabaseConstruct } from './database';

interface ApiProps {
  auth: AuthConstruct;
  database: DatabaseConstruct;
}

export class ApiConstruct extends Construct {
  readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);

    const { auth, database } = props;
    const stackName = cdk.Stack.of(this).stackName;

    // ── Lambda ────────────────────────────────────────────────────────────────
    const apiFn = new lambda.Function(this, 'ApiFunction', {
      functionName: `${stackName}-api`,
      description: 'FastAPI — stateless, auth handled upstream by API Gateway',
      runtime: lambda.Runtime.PYTHON_3_13,
      architecture: lambda.Architecture.ARM_64,
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
          platform: 'linux/arm64',
          command: [
            'bash', '-c',
            'pip install . -t /asset-output && cp -r handler.py app /asset-output',
          ],
        },
      }),
      timeout: cdk.Duration.seconds(29),
      memorySize: 512,
      environment: {
        ENVIRONMENT: 'dev',
        // Add a new env var here for every new table in DatabaseConstruct.
        ITEMS_TABLE: database.itemsTable.tableName,
        // ORDERS_TABLE:   database.ordersTable.tableName,
        // INVOICES_TABLE: database.invoicesTable.tableName,
      },
    });

    // Grant Lambda read/write access to each table.
    database.itemsTable.grantReadWriteData(apiFn);
    // database.ordersTable.grantReadWriteData(apiFn);
    // database.invoicesTable.grantReadWriteData(apiFn);

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
