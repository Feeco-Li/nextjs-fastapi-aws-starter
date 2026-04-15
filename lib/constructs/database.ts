import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

interface DatabaseProps {
  vpc: ec2.Vpc;
}

export class DatabaseConstruct extends Construct {
  readonly cluster: rds.DatabaseCluster;
  readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id);

    const { vpc } = props;
    const stackName = cdk.Stack.of(this).stackName;

    // Aurora's security group — inbound rule added by ApiConstruct (Lambda → 5432)
    this.securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc,
      description: 'Aurora PostgreSQL - allow inbound from Lambda',
      allowAllOutbound: false,
    });

    this.cluster = new rds.DatabaseCluster(this, 'Cluster', {
      clusterIdentifier: `${stackName}-aurora`,
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_4,
      }),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 4,
      writer: rds.ClusterInstance.serverlessV2('writer'),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [this.securityGroup],
      defaultDatabaseName: 'appdb',
      credentials: rds.Credentials.fromGeneratedSecret('postgres'),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}
