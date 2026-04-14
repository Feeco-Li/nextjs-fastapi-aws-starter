#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { MainStack } from '../lib/stack';

const app = new cdk.App();

new MainStack(app, 'fastapi-cdk-starter', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region:  process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
  description: 'FastAPI + Cognito on AWS (CDK)',
});
