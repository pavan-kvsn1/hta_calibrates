// PostgreSQL Prisma configuration for integration testing
// Used in CI for production-parity testing
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.postgres.prisma",
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
