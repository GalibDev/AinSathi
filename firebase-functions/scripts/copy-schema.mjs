import { copyFileSync } from 'node:fs';
copyFileSync(new URL('../../src/lib/schema.ts',import.meta.url),new URL('../src/schema.ts',import.meta.url));
