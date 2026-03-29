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
export declare function createDb(connectionString: string): import("drizzle-orm/postgres-js").PostgresJsDatabase<typeof schema> & {
    $client: postgres.Sql<{}>;
};
export type Database = ReturnType<typeof createDb>;
//# sourceMappingURL=client.d.ts.map