import "server-only";

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type UsageEntry = {
  id: string;
  feature: string;
  estimatedCostUsd: number;
  createdAt: string;
  cacheKey: string;
};

type CacheEntry = {
  createdAt: string;
  payload: unknown;
};

type BudgetStore = {
  usage: UsageEntry[];
  cache: Record<string, CacheEntry>;
};

const STORE_PATH = path.join(process.cwd(), ".private", "ai-usage.json");
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
let lock = Promise.resolve();

function monthKey(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

export function makeAiCacheKey(feature: string, input: unknown): string {
  return createHash("sha256")
    .update(`${feature}:${JSON.stringify(input)}`)
    .digest("hex");
}

async function readStore(): Promise<BudgetStore> {
  try {
    const parsed = JSON.parse(await readFile(STORE_PATH, "utf8")) as BudgetStore;
    return {
      usage: Array.isArray(parsed.usage) ? parsed.usage : [],
      cache: parsed.cache && typeof parsed.cache === "object" ? parsed.cache : {},
    };
  } catch {
    return { usage: [], cache: {} };
  }
}

async function writeStore(store: BudgetStore): Promise<void> {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export async function inspectAiBudget(): Promise<{
  limitUsd: number;
  usedUsd: number;
  remainingUsd: number;
}> {
  const store = await readStore();
  const limitUsd = Number(process.env.OPENAI_MONTHLY_BUDGET_USD || "10");
  const currentMonth = monthKey();
  const usedUsd = store.usage
    .filter((entry) => entry.createdAt.startsWith(currentMonth))
    .reduce((sum, entry) => sum + entry.estimatedCostUsd, 0);
  return {
    limitUsd,
    usedUsd: Number(usedUsd.toFixed(4)),
    remainingUsd: Number(Math.max(0, limitUsd - usedUsd).toFixed(4)),
  };
}

export async function reserveAiBudget({
  feature,
  estimatedCostUsd,
  cacheKey,
}: {
  feature: string;
  estimatedCostUsd: number;
  cacheKey: string;
}): Promise<
  | { allowed: true; cachedPayload?: unknown; budget: Awaited<ReturnType<typeof inspectAiBudget>> }
  | { allowed: false; budget: Awaited<ReturnType<typeof inspectAiBudget>> }
> {
  let result:
    | { allowed: true; cachedPayload?: unknown; budget: Awaited<ReturnType<typeof inspectAiBudget>> }
    | { allowed: false; budget: Awaited<ReturnType<typeof inspectAiBudget>> };

  lock = lock.then(async () => {
    const store = await readStore();
    const cached = store.cache[cacheKey];
    if (cached && Date.now() - new Date(cached.createdAt).getTime() < CACHE_TTL_MS) {
      result = { allowed: true, cachedPayload: cached.payload, budget: await inspectAiBudget() };
      return;
    }

    const budget = await inspectAiBudget();
    if (budget.usedUsd + estimatedCostUsd > budget.limitUsd) {
      result = { allowed: false, budget };
      return;
    }

    store.usage.push({
      id: `AI-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      feature,
      estimatedCostUsd,
      createdAt: new Date().toISOString(),
      cacheKey,
    });
    await writeStore(store);
    result = {
      allowed: true,
      budget: {
        ...budget,
        usedUsd: Number((budget.usedUsd + estimatedCostUsd).toFixed(4)),
        remainingUsd: Number(Math.max(0, budget.remainingUsd - estimatedCostUsd).toFixed(4)),
      },
    };
  });
  await lock;
  return result!;
}

export async function cacheAiResponse(cacheKey: string, payload: unknown): Promise<void> {
  lock = lock.then(async () => {
    const store = await readStore();
    store.cache[cacheKey] = { createdAt: new Date().toISOString(), payload };
    const cutoff = Date.now() - CACHE_TTL_MS;
    Object.entries(store.cache).forEach(([key, value]) => {
      if (new Date(value.createdAt).getTime() < cutoff) delete store.cache[key];
    });
    await writeStore(store);
  });
  await lock;
}
