import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class DatabaseConstruct extends Construct {
  readonly itemsTable: dynamodb.Table;
  // Add new tables here as your app grows:
  // readonly ordersTable: dynamodb.Table;
  // readonly invoicesTable: dynamodb.Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const stackName = cdk.Stack.of(this).stackName;

    this.itemsTable = new dynamodb.Table(this, 'ItemsTable', {
      tableName: `${stackName}-items`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // this.ordersTable = new dynamodb.Table(this, 'OrdersTable', {
    //   tableName: `${stackName}-orders`,
    //   partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
    //   billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    //   removalPolicy: cdk.RemovalPolicy.DESTROY,
    // });
  }
}
