import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { startProdServer } from 'vinext/server/prod-server';

const server = await startProdServer({ port: 0, host: '127.0.0.1', outDir: path.resolve('dist') });
try {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/`, { signal: AbortSignal.timeout(15000) });
  const html = await response.text();
  if (!response.ok || !html.includes('<html')) throw new Error(`Pre-render failed: HTTP ${response.status}`);
  await writeFile('dist/client/index.html', html);
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
