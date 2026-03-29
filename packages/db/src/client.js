import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
/**
 * Creates a Drizzle database client bound to the given Postgres connection
 * string. The returned instance is fully typed against the OpenGive schema.
 *
 * Usage:
 *   import { createDb } from '@opengive/db/client';
 *   const db = createDb(process.env.DATABASE_URL!);
 */
export function createDb(connectionString) {
    const client = postgres(connectionString);
    return drizzle(client, { schema });
}
//# sourceMappingURL=client.js.map