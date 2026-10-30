import type { Knex } from 'knex';
import { logger } from './logger';

interface MssqlConnection {
  closed: boolean;
  inTransaction: boolean;
  state: { name: string };
  __knex__disposed?: string;
  close(): void;
}

/** Protect the pool boundary, including failures in Knex's own rollback. */
export function guardMssqlPool(database: Knex): void {
  const client = database.client;
  const release = client.releaseConnection.bind(client);
  const destroy = client.destroyRawConnection.bind(client);

  // Tedious emits `end` only on its first close. Knex's normal destroy waits
  // for that event, so destroying an already discarded connection must be a no-op.
  client.destroyRawConnection = (connection: MssqlConnection) =>
    connection.closed ? Promise.resolve() : destroy(connection);

  client.releaseConnection = (connection: MssqlConnection) => {
    if (!connection.closed && (connection.inTransaction || connection.state.name !== 'LoggedIn')) {
      connection.__knex__disposed = 'Connection returned with unfinished SQL work';
      logger.error('[db] Discarding connection returned with unfinished SQL work', {
        inTransaction: connection.inTransaction,
        state: connection.state.name,
      });
      // Close before release: even an idle pool with no pending acquisitions
      // must release the server-side transaction and its locks immediately.
      connection.close();
    }
    return release(connection);
  };
}
