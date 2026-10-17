import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { UsageDatabase, UsageResult, UsageStatement } from "../../server/ai-usage";

class Statement implements UsageStatement {
  private values: (string | number)[] = [];

  constructor(
    private database: DatabaseSync,
    private query: string,
  ) {}

  bind(...values: (string | number)[]): UsageStatement {
    this.values = values;
    return this;
  }

  execute(): UsageResult {
    const result = this.database.prepare(this.query).run(...this.values);
    return { success: true, meta: { changes: Number(result.changes) } };
  }

  async run(): Promise<UsageResult> {
    return this.execute();
  }
}

export function createUsageDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync("migrations/0001_ai_usage.sql", "utf8"));
  const database: UsageDatabase = {
    prepare: (query) => new Statement(sqlite, query),
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = statements.map((statement) => {
          if (!(statement instanceof Statement)) throw new Error("Unknown statement");
          return statement.execute();
        });
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return {
    database,
    used: (key: string) =>
      sqlite.prepare("SELECT used FROM ai_usage_buckets WHERE bucket = ?").get(key)?.["used"] ?? 0,
    close: () => sqlite.close(),
  };
}
