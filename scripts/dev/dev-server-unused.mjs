// Launch the Express backend on an UNUSED local port (default 41838) so it can
// run alongside another instance already holding 41837.
//
// The port is picked without a shell helper: whatever is passed in PORT wins,
// then the first free candidate is used. Vite proxies /api to this port — see
// `server.proxy` in vite.config.ts (skip strictPort collisions by using
// port 5176, which is kept free for this stack).
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');

// Must match `server.proxy['/api'].target` in vite.config.ts, which reads
// PHARMACHAIN_API_PORT (default 41838) so the two can be kept in lockstep.
const VITE_PROXY_PORT = Number(process.env.PHARMACHAIN_API_PORT) || 41838;

const CANDIDATES = [41838, 41839, 41840, 41841, 41842];

/** Resolves to true when nothing is listening on the port. */
function isFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '::');
  });
}

const requested = Number(process.env.PORT) || null;
const order = requested ? [requested] : CANDIDATES;

let chosen = null;
for (const port of order) {
  if (await isFree(port)) {
    chosen = port;
    break;
  }
  console.log(`port ${port} is in use — trying the next candidate`);
}

if (!chosen) {
  console.error(`No free port among: ${order.join(', ')}.`);
  process.exit(1);
}

// The Vite proxy hardcodes a single target (see `server.proxy` in
// vite.config.ts). Picking a different port silently breaks /api: the dev
// server still serves the SPA, but every API call fails to connect. So if we
// could not take the port Vite expects, say so loudly instead of leaving a
// half-working stack.
if (chosen !== VITE_PROXY_PORT) {
  console.warn(
    `\n  WARNING: backend is on ${chosen}, but vite.config.ts proxies /api -> ${VITE_PROXY_PORT}.\n` +
      `  The SPA will load and every API call will fail. Either free ${VITE_PROXY_PORT}, or start\n` +
      `  the dev server with a matching target:  PHARMACHAIN_API_PORT=${chosen} npm run dev\n`,
  );
}

console.log(`Starting PharmaChain backend on unused port ${chosen}...`);
const child = spawn(process.execPath, [path.join('server', 'index.cjs')], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, PORT: String(chosen) },
});
child.on('exit', (code) => process.exit(code ?? 0));
