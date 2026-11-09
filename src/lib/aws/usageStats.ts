import "server-only";

import { QueryCommand, type QueryCommandOutput } from "@aws-sdk/lib-dynamodb";

import { getAwsRoleArn, getDynamoDocClient } from "./client";
import { createFakeUsageStatsStore } from "./fake";
import type { DailyStat, UsageStatsStore } from "./types";

// Daily usage per key from DynamoDB ApiDailyUsageStats (plan §7, MON-05),
// which the API platform writes. Only the nightly sync calls this; pages
// read the copy in usage_daily (Q3).
//
// The table's partition key is ApiKey (the API Gateway key ID) and its sort
// key is Date ("YYYY-MM-DD"); Success and NotFound are the day's counts, as
// read by mintly-web's usage Lambda.

type Env = Record<string, string | undefined>;

export function getUsageStatsTable(env: Env = process.env): string {
  return env.USAGE_STATS_TABLE?.trim() || "ApiDailyUsageStats";
}

const count = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

/** One DynamoDB item as a DailyStat, or null if it has no usable date. */
export function toDailyStat(item: Record<string, unknown>): DailyStat | null {
  const date = String(item.Date ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return { date, success: count(item.Success), notFound: count(item.NotFound) };
}

function createDynamoUsageStatsStore(): UsageStatsStore {
  return {
    async readDailyStats(keyId, from, to) {
      const stats: DailyStat[] = [];
      let start: QueryCommandOutput["LastEvaluatedKey"];
      do {
        const page: QueryCommandOutput = await getDynamoDocClient().send(
          new QueryCommand({
            TableName: getUsageStatsTable(),
            // Date is a DynamoDB reserved word.
            KeyConditionExpression: "ApiKey = :key AND #date BETWEEN :from AND :to",
            ExpressionAttributeNames: { "#date": "Date" },
            ExpressionAttributeValues: { ":key": keyId, ":from": from, ":to": to },
            ExclusiveStartKey: start,
          }),
        );
        for (const item of page.Items ?? []) {
          const stat = toDailyStat(item);
          if (stat) stats.push(stat);
        }
        start = page.LastEvaluatedKey;
      } while (start);
      return stats;
    },
  };
}

let store: UsageStatsStore | null = null;

/** DynamoDB, or the fake without AWS_ROLE_ARN. */
export function usageStatsStore(): UsageStatsStore {
  store ??= getAwsRoleArn() ? createDynamoUsageStatsStore() : createFakeUsageStatsStore();
  return store;
}

export const readDailyStats = (keyId: string, from: string, to: string) =>
  usageStatsStore().readDailyStats(keyId, from, to);
