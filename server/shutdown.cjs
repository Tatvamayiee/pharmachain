// ---------------------------------------------------------------------------
// Graceful shutdown for the Express server.
//
// On SIGTERM (Render/Docker stop) or SIGINT (Ctrl+C):
//   1. stop accepting NEW connections (server.close)
//   2. wait (bounded) for in-flight requests to finish — long AI calls can
//      legitimately take ~60-120s, hence the generous default grace period
//   3. close the MongoDB connection cleanly
//   4. exit 0
// A second signal, or the grace period expiring, forces an immediate exit.
// No behavior change while the server is running — this only matters at stop.
// ---------------------------------------------------------------------------

const DEFAULT_GRACE_MS = 30_000;

function setupGracefulShutdown({ server, db, graceMs = DEFAULT_GRACE_MS } = {}) {
  if (!server) return () => {};

  let shuttingDown = false;

  const shutdown = async (signal) => {
    if (shuttingDown) {
      // Second signal: the operator insists. Exit immediately.
      console.error(`[shutdown] ${signal} received again — forcing exit now.`);
      process.exit(1);
    }
    shuttingDown = true;
    console.log(`[shutdown] ${signal} received — closing server (grace ${graceMs / 1000}s)…`);

    const forceTimer = setTimeout(() => {
      console.error('[shutdown] Grace period expired — forcing exit.');
      process.exit(1);
    }, graceMs);
    // Don't hold the event loop open just for this timer.
    forceTimer.unref();

    // 1+2. Stop accepting new connections; wait for in-flight requests.
    server.close(async () => {
      // 3. Release the database (mongoose) if it is connected.
      try {
        if (db && typeof db.close === 'function') await db.close();
      } catch (err) {
        console.error('[shutdown] DB close failed:', err && err.message ? err.message : err);
      }
      console.log('[shutdown] Bye.');
      process.exit(0);
    });

    // server.close's callback only fires once all connections drain. A keep-
    // alive browser connection or a hung socket would otherwise block exit —
    // that's what the force timer above is for.
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return shutdown;
}

module.exports = { setupGracefulShutdown };
