/**
 * Database client — Drizzle ORM with libsql/SQLite.
 * Switch to PostgreSQL by changing the driver and connection string.
 */

import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const client = createClient({
  url: process.env.DATABASE_URL || "file:./dev.db",
});

export const db = drizzle(client, { schema });

export { schema };
