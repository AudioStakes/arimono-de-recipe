export type UsageResult = {
  success: boolean;
  meta?: { changes?: number };
};

export type UsageStatement = {
  bind(...values: (string | number)[]): UsageStatement;
  run(): Promise<UsageResult>;
};

export type UsageDatabase = {
  prepare(query: string): UsageStatement;
  batch(statements: UsageStatement[]): Promise<UsageResult[]>;
};

export type UsageBucket = {
  key: string;
  amount: number;
  limit: number;
  expiresAt: number;
};

export type UsageReservation = "reserved" | "limited" | "unavailable";

export async function requesterUsageKey(
  request: Request,
  secret: string | undefined,
  day: number,
): Promise<string | null> {
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip || !secret || secret.length < 32 || !Number.isSafeInteger(day)) return null;
  let network: string;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)) {
    if (ip.split(".").some((part) => Number(part) > 255)) return null;
    network = ip.split(".").map(Number).join(".");
  } else if (/^[0-9a-f:]+$/i.test(ip) && ip.includes(":")) {
    try {
      const normalized = new URL(`https://[${ip}]/`).hostname.slice(1, -1);
      const [head = "", tail] = normalized.split("::");
      const left = head ? head.split(":") : [];
      const right = tail ? tail.split(":") : [];
      const words =
        tail === undefined
          ? left
          : [...left, ...Array<string>(8 - left.length - right.length).fill("0"), ...right];
      network = `ipv6:${words.slice(0, 4).join(":")}`;
    } catch {
      return null;
    }
  } else return null;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(`${day}:${network}`));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

export async function reserveUsage(
  database: UsageDatabase,
  buckets: UsageBucket[],
  now: number,
): Promise<UsageReservation> {
  if (
    !Number.isSafeInteger(now) ||
    now < 0 ||
    !buckets.length ||
    buckets.some(
      (bucket) =>
        !bucket.key ||
        !Number.isSafeInteger(bucket.amount) ||
        bucket.amount <= 0 ||
        !Number.isSafeInteger(bucket.limit) ||
        bucket.limit <= 0 ||
        !Number.isSafeInteger(bucket.expiresAt) ||
        bucket.expiresAt < 0 ||
        (bucket.expiresAt !== 0 && bucket.expiresAt <= now),
    )
  )
    return "unavailable";

  try {
    const cleanup = await database
      .prepare("DELETE FROM ai_usage_buckets WHERE expires_at > 0 AND expires_at <= ?")
      .bind(now)
      .run();
    if (!cleanup.success) return "unavailable";
    // The CHECK constraint makes an exhausted bucket abort the entire D1 transaction.
    // A conditional UPDATE with zero changed rows would not roll the batch back.
    const statements = buckets.map((bucket) =>
      database
        .prepare(`
      INSERT INTO ai_usage_buckets (bucket, used, max_units, expires_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(bucket) DO UPDATE SET
        used = ai_usage_buckets.used + excluded.used,
        max_units = MIN(ai_usage_buckets.max_units, excluded.max_units),
        expires_at = CASE WHEN ai_usage_buckets.expires_at = excluded.expires_at
          THEN ai_usage_buckets.expires_at ELSE NULL END
    `)
        .bind(bucket.key, bucket.amount, bucket.limit, bucket.expiresAt),
    );
    const results = await database.batch(statements);
    return results.length === statements.length &&
      results.every((result) => result.success && result.meta?.changes === 1)
      ? "reserved"
      : "unavailable";
  } catch (error) {
    return error instanceof Error && error.message.includes("ai_usage_within_limit")
      ? "limited"
      : "unavailable";
  }
}
