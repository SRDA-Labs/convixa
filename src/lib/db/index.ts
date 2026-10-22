import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// PostgreSQL connection string (required)
function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is required. Set it to your PostgreSQL connection string (e.g., postgresql://user:password@localhost:5432/convixa)"
    );
  }
  return url;
}

let _db: ReturnType<typeof drizzle<typeof schema>>;
function getDb() {
  if (!_db) {
    const connectionString = getConnectionString();
    // Limit pool size to avoid exhausting DB max_connections (e.g. free tier / 53300 error)
    const client = postgres(connectionString, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    _db = drizzle(client, { schema });
  }
  return _db;
}
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_, prop) {
    return getDb()[prop as keyof ReturnType<typeof drizzle<typeof schema>>];
  },
});
export * from "./schema";
