import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import viteConfig from '../../vite.config';

const repoRoot = path.resolve(__dirname, '..', '..');

const getManualChunks = () => {
  const output = viteConfig.build?.rollupOptions?.output;
  const normalizedOutput = Array.isArray(output) ? output[0] : output;
  return normalizedOutput?.manualChunks;
};

describe('build policy', () => {
  it('keeps React Three dependencies in explicit async vendor chunks', () => {
    const manualChunks = getManualChunks();
    const packageJson = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

    expect(typeof manualChunks).toBe('function');
    expect(manualChunks('C:/repo/node_modules/three/build/three.module.js')).toBe('three');
    expect(manualChunks('C:/repo/node_modules/@react-three/fiber/dist/index.js')).toBe('react-three');
    expect(packageJson.dependencies).not.toHaveProperty('@react-three/drei');
    expect(viteConfig.build?.chunkSizeWarningLimit).toBe(650);
  });

  it('uses GitHub Actions versions with Node 24 action runtimes', () => {
    const workflow = readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');

    expect(workflow).toContain('uses: actions/checkout@v7');
    expect(workflow).toContain('uses: actions/setup-node@v6');
    expect(workflow).toContain('node-version: 24');
    expect(workflow).not.toMatch(/uses: actions\/(?:checkout|setup-node)@v4/);
    expect(workflow).not.toMatch(/node-version:\s*20/);
  });
});
