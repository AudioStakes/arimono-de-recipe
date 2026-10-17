import { describe, expect, test } from "vitest";
import { requesterUsageKey, reserveUsage, type UsageBucket } from "../../server/ai-usage";
import { createUsageDatabase } from "../helpers/usage-database";

const bucket = (key: string, amount: number, limit: number, expiresAt = 100): UsageBucket => ({
  key,
  amount,
  limit,
  expiresAt,
});

describe("durable AI usage reservations", () => {
  test("identity uses only the trusted edge IP, groups IPv6 /64, and rotates daily", async () => {
    const request = (ip: string) =>
      new Request("https://example.test/api/recipe", { headers: { "CF-Connecting-IP": ip } });
    const secret = "test-secret-with-at-least-32-characters";
    const key = await requesterUsageKey(request("192.0.2.1"), secret, 1);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(await requesterUsageKey(request("192.0.2.1"), secret, 2)).not.toBe(key);
    expect(await requesterUsageKey(request("2001:db8:0:1::1"), secret, 1)).toBe(
      await requesterUsageKey(request("2001:db8:0:1::99"), secret, 1),
    );
    expect(
      await requesterUsageKey(
        new Request("https://example.test", { headers: { "X-Forwarded-For": "192.0.2.1" } }),
        secret,
        1,
      ),
    ).toBeNull();
    expect(await requesterUsageKey(request("192.0.2.1"), "short", 1)).toBeNull();
    expect(await requesterUsageKey(request("not-an-ip"), secret, 1)).toBeNull();
  });
  test("all limits reserve atomically and a rejected bucket rolls the whole request back", async () => {
    const store = createUsageDatabase();
    try {
      expect(
        await reserveUsage(store.database, [bucket("user", 1, 2), bucket("provider", 9, 10)], 1),
      ).toBe("reserved");
      expect(
        await reserveUsage(store.database, [bucket("user", 1, 2), bucket("provider", 2, 10)], 1),
      ).toBe("limited");
      expect(store.used("user")).toBe(1);
      expect(store.used("provider")).toBe(9);
    } finally {
      store.close();
    }
  });

  test("concurrent callers and separate reservations cannot overspend the same balance", async () => {
    const store = createUsageDatabase();
    try {
      const outcomes = await Promise.all(
        Array.from({ length: 50 }, () =>
          reserveUsage(store.database, [bucket("credit-lifetime", 1000, 62500, 0)], 1),
        ),
      );
      expect(outcomes.filter((value) => value === "reserved")).toHaveLength(50);
      const rest = await Promise.all(
        Array.from({ length: 30 }, () =>
          reserveUsage(store.database, [bucket("credit-lifetime", 1000, 62500, 0)], 1),
        ),
      );
      expect(rest.filter((value) => value === "reserved")).toHaveLength(12);
      expect(store.used("credit-lifetime")).toBe(62000);
      expect(
        await reserveUsage(store.database, [bucket("credit-lifetime", 501, 62500, 0)], 200),
      ).toBe("limited");
      expect(store.used("credit-lifetime")).toBe(62000);
    } finally {
      store.close();
    }
  });

  test("only expiring counters reset and raising configuration cannot refill an existing budget", async () => {
    const store = createUsageDatabase();
    try {
      expect(
        await reserveUsage(store.database, [bucket("day", 1, 1), bucket("lifetime", 1, 1, 0)], 1),
      ).toBe("reserved");
      expect(
        await reserveUsage(
          store.database,
          [bucket("day", 1, 2, 300), bucket("lifetime", 1, 999, 0)],
          200,
        ),
      ).toBe("limited");
      expect(store.used("lifetime")).toBe(1);
      expect(store.used("day")).toBe(0);
      expect(await reserveUsage(store.database, [bucket("next-day", 1, 1, 300)], 200)).toBe(
        "reserved",
      );
    } finally {
      store.close();
    }
  });

  test("expired buckets and changing a counter's expiry fail closed", async () => {
    const store = createUsageDatabase();
    try {
      expect(await reserveUsage(store.database, [bucket("expired", 1, 1, 100)], 100)).toBe(
        "unavailable",
      );
      expect(await reserveUsage(store.database, [bucket("expired", 1, 1, 99)], 100)).toBe(
        "unavailable",
      );
      expect(store.used("expired")).toBe(0);
      expect(await reserveUsage(store.database, [bucket("same-key", 1, 10, 200)], 100)).toBe(
        "reserved",
      );
      expect(await reserveUsage(store.database, [bucket("same-key", 1, 10, 0)], 100)).toBe(
        "unavailable",
      );
      expect(store.used("same-key")).toBe(1);
    } finally {
      store.close();
    }
  });

  test("missing database results, invalid amounts and storage errors fail closed", async () => {
    const store = createUsageDatabase();
    try {
      expect(await reserveUsage(store.database, [bucket("bad", 0, 3)], 1)).toBe("unavailable");
      expect(await reserveUsage(store.database, [bucket("bad", 1.1, 3)], 1)).toBe("unavailable");
      expect(
        await reserveUsage(
          { ...store.database, batch: async () => [] },
          [bucket("missing", 1, 2)],
          1,
        ),
      ).toBe("unavailable");
      expect(
        await reserveUsage(
          {
            ...store.database,
            batch: async () => {
              throw new Error("private database information");
            },
          },
          [bucket("failed", 1, 2)],
          1,
        ),
      ).toBe("unavailable");
    } finally {
      store.close();
    }
  });
});
