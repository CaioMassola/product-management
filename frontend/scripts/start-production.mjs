import { access, cp } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const frontendRoot = fileURLToPath(new URL('../', import.meta.url));
const standaloneRoot = join(frontendRoot, '.next', 'standalone');
const standaloneServer = join(standaloneRoot, 'server.js');
await access(standaloneServer).catch(() => {
  throw new Error('Run npm run build before npm start.');
});
await cp(
  join(frontendRoot, '.next', 'static'),
  join(standaloneRoot, '.next', 'static'),
  { recursive: true },
);
process.env.HOSTNAME = process.env.PRODUCT_MANAGEMENT_HOST ?? '127.0.0.1';
await import(pathToFileURL(standaloneServer).href);
