import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import viteConfig from '../../vite.config';
import { PRODUCTION_CSP, PRODUCTION_CSP_DIRECTIVES, PRODUCTION_CSP_HEADER } from './securityPolicy';

const repoRoot = path.resolve(__dirname, '..', '..');

const getManualChunks = () => {
  const output = viteConfig.build?.rollupOptions?.output;
  const normalizedOutput = Array.isArray(output) ? output[0] : output;
  return normalizedOutput?.manualChunks as ((id: string) => string | undefined) | undefined;
};

describe('build policy', () => {
  it('keeps React Three dependencies in explicit async vendor chunks', () => {
    const manualChunks = getManualChunks();
    const packageJson = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

    expect(typeof manualChunks).toBe('function');
    expect(manualChunks?.('C:/repo/node_modules/three/build/three.module.js')).toBe('three');
    expect(manualChunks?.('C:/repo/node_modules/@react-three/fiber/dist/index.js')).toBe('react-three');
    expect(packageJson.dependencies).not.toHaveProperty('@react-three/drei');
    expect(viteConfig.build?.chunkSizeWarningLimit).toBe(650);
  });

  it('keeps React out of the 3D chunk, so the entry never pulls in three.js', () => {
    const manualChunks = getManualChunks()!;
    // When React landed in "react-three", the entry imported that chunk and three.js with it.
    expect(manualChunks('/repo/node_modules/react/index.js')).toBe('react');
    expect(manualChunks('/repo/node_modules/react-dom/cjs/react-dom.production.min.js')).toBe('react');
    expect(manualChunks('/repo/node_modules/scheduler/index.js')).toBe('react');
    expect(manualChunks('/repo/node_modules/react-reconciler/index.js')).toBe('react-three');
    expect(manualChunks('/repo/node_modules/@radix-ui/react-dialog/node_modules/react/index.js')).toBe('react');
    expect(manualChunks('/repo/src/App.tsx')).toBeUndefined();
  });

  it('ships one strict Content-Security-Policy in the page and in the response header', () => {
    const vercel = JSON.parse(readFileSync(path.join(repoRoot, 'vercel.json'), 'utf8'));
    const headers = vercel.headers.find((rule: { source: string }) => rule.source === '/(.*)').headers as Array<{ key: string; value: string }>;
    expect(headers.find((header) => header.key === 'Content-Security-Policy')?.value).toBe(PRODUCTION_CSP_HEADER);
    expect(PRODUCTION_CSP_HEADER).toBe(`${PRODUCTION_CSP}; frame-ancestors 'none'`);
    const directives = Object.fromEntries(PRODUCTION_CSP_DIRECTIVES);
    expect(directives['default-src']).toBe("'none'");
    expect(directives['script-src']).toBe("'self'");
    expect(directives['connect-src']).toBe("'self'");
    expect(PRODUCTION_CSP).not.toMatch(/unsafe-eval|ws:|wss:|\*/);
    // Deep links (/research, /replay, ...) must reach the app instead of a 404.
    expect(vercel.rewrites).toEqual([{ source: '/(.*)', destination: '/index.html' }]);
    expect(headers.map((header) => header.key)).toEqual(
      expect.arrayContaining(['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy', 'Cross-Origin-Opener-Policy']),
    );
  });

  it('uses GitHub Actions versions with Node 24 action runtimes', () => {
    const workflow = readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');

    expect(workflow).toContain('uses: actions/checkout@v7');
    expect(workflow).toContain('uses: actions/setup-node@v6');
    expect(workflow).toContain('node-version: 24');
    expect(workflow).not.toMatch(/uses: actions\/(?:checkout|setup-node)@v4/);
    expect(workflow).not.toMatch(/node-version:\s*20/);
    expect(workflow).not.toMatch(/uses: actions\/upload-artifact@v[1-5]\b/);
  });
});
