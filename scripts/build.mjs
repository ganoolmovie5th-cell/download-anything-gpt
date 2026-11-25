import { cp, mkdir, rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist');
await cp('public', 'dist', { recursive: true });
await cp(new URL(import.meta.resolve('@vercel/analytics')), 'dist/analytics.js');
console.log('Static assets built in dist/; API functions are served by Vercel.');
