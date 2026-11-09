import "server-only";

import { APIGatewayClient } from "@aws-sdk/client-api-gateway";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";

// AWS credentials come from Vercel OIDC federation: each environment assumes
// its own narrowly scoped IAM role (plan §7). No AWS keys are stored.

type Env = Record<string, string | undefined>;

export function getAwsRoleArn(env: Env = process.env): string | null {
  return env.AWS_ROLE_ARN?.trim() || null;
}

export function getAwsRegion(env: Env = process.env): string {
  return env.AWS_REGION?.trim() || "eu-west-2";
}

let client: APIGatewayClient | null = null;

export function getApiGatewayClient(env: Env = process.env): APIGatewayClient {
  const roleArn = getAwsRoleArn(env);
  if (!roleArn) throw new Error("AWS_ROLE_ARN is not set (see .env.example).");
  client ??= new APIGatewayClient({
    region: getAwsRegion(env),
    credentials: awsCredentialsProvider({ roleArn, roleSessionName: "mintly-app" }),
  });
  return client;
}
