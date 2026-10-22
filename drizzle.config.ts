import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Load env so drizzle-kit CLI sees DATABASE_URL when run outside Next.js
config({ path: ".env" });

// PostgreSQL connection string from environment
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is required. Set it to your PostgreSQL connection string (e.g., postgresql://user:password@localhost:5432/convixa)"
  );
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
