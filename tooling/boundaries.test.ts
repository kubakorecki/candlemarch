// Enforces the import rules from CLAUDE.md that the type system and Biome can't see:
// declared workspace dependencies, and hidden inputs in the simulation.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..');

/** Which workspace packages each package may depend on (CLAUDE.md "Import rules"). */
const allowedWorkspaceDeps: Record<string, string[]> = {
  content: [],
  sim: ['@candlemarch/content'],
  client: ['@candlemarch/sim', '@candlemarch/content'],
};

/** Which third-party runtime dependencies each package may have. */
const allowedExternalDeps: Record<string, string[] | 'any'> = {
  content: [],
  sim: [],
  client: 'any',
};

function readManifest(pkg: string): {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
} {
  return JSON.parse(readFileSync(join(root, 'packages', pkg, 'package.json'), 'utf8'));
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
    .map((f) => join(dir, f));
}

describe('package boundaries', () => {
  it('covers exactly the packages on disk', () => {
    const onDisk = readdirSync(join(root, 'packages')).sort();
    expect(onDisk).toEqual(Object.keys(allowedWorkspaceDeps).sort());
  });

  for (const pkg of Object.keys(allowedWorkspaceDeps)) {
    it(`${pkg} declares only allowed dependencies`, () => {
      const manifest = readManifest(pkg);
      const deps = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
      const workspace = deps.filter((d) => d.startsWith('@candlemarch/'));
      const external = deps.filter((d) => !d.startsWith('@candlemarch/'));

      for (const dep of workspace) {
        expect(allowedWorkspaceDeps[pkg], `${pkg} -> ${dep}`).toContain(dep);
      }
      const allowedExternal = allowedExternalDeps[pkg];
      if (allowedExternal !== 'any') {
        expect(external, `${pkg} external deps`).toEqual(allowedExternal);
      }
    });
  }

  it('content and sim import no other workspace package than allowed', () => {
    for (const pkg of ['content', 'sim']) {
      const allowed = allowedWorkspaceDeps[pkg] ?? [];
      for (const file of sourceFiles(join(root, 'packages', pkg, 'src'))) {
        const text = readFileSync(file, 'utf8');
        for (const match of text.matchAll(/from\s+'([^']+)'/g)) {
          const spec = match[1] ?? '';
          if (spec.startsWith('.')) continue;
          expect(allowed, `${relative(root, file)} imports ${spec}`).toContain(spec);
        }
      }
    }
  });

  it('the balance harness imports sim and content only (and vitest in tests)', () => {
    for (const file of sourceFiles(join(root, 'tooling', 'balance'))) {
      const allowed = ['@candlemarch/sim', '@candlemarch/content'];
      if (file.endsWith('.test.ts')) allowed.push('vitest');
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/from\s+'([^']+)'/g)) {
        const spec = match[1] ?? '';
        if (spec.startsWith('.')) continue;
        expect(allowed, `${relative(root, file)} imports ${spec}`).toContain(spec);
      }
    }
  });

  it('the map-size benchmark imports sim, content and Node built-ins only (and vitest in tests)', () => {
    for (const file of sourceFiles(join(root, 'tooling', 'benchmark'))) {
      const allowed = ['@candlemarch/sim', '@candlemarch/content'];
      if (file.endsWith('.test.ts')) allowed.push('vitest');
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/from\s+'([^']+)'/g)) {
        const spec = match[1] ?? '';
        if (spec.startsWith('.') || spec.startsWith('node:')) continue;
        expect(allowed, `${relative(root, file)} imports ${spec}`).toContain(spec);
      }
    }
  });

  it('sim has no hidden inputs', () => {
    const forbidden = [/Math\.random/, /Date\.now/, /new Date\(/, /performance\.now/];
    for (const file of sourceFiles(join(root, 'packages', 'sim', 'src'))) {
      const text = readFileSync(file, 'utf8');
      for (const pattern of forbidden) {
        expect(pattern.test(text), `${relative(root, file)} uses ${pattern.source}`).toBe(false);
      }
    }
  });
});
