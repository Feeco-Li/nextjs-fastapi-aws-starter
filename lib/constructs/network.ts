import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class NetworkConstruct extends Construct {
  readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // Lambda reads Aurora credentials from Secrets Manager without needing internet.
    this.vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
    });
  }
}
