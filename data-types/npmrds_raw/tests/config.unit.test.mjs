/**
 * Unit tests for npmrds_raw RITIS config loading.
 * Secrets live in a gitignored ritis.config.json (per-env). These tests use
 * temp fixtures — never the real secrets file, never RITIS.
 */
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateRitisConfig, loadRitisConfig } from '../config.js';

const full = { url: 'https://npmrds.ritis.org', username: 'u', password: 'p', totpSecret: 'S' };

describe('validateRitisConfig', () => {
  it('accepts a complete config and returns the normalized fields', () => {
    expect(validateRitisConfig(full)).toEqual(full);
  });
  it('throws listing the missing keys', () => {
    expect(() => validateRitisConfig({ url: 'x' })).toThrow(/username/);
    expect(() => validateRitisConfig({ url: 'x' })).toThrow(/password/);
    expect(() => validateRitisConfig({ url: 'x' })).toThrow(/totpSecret/);
  });
  it('never logs or includes secret VALUES in the error', () => {
    let msg = '';
    try { validateRitisConfig({ url: 'x', password: 'hunter2' }); } catch (e) { msg = e.message; }
    expect(msg).not.toContain('hunter2');
  });
});

describe('loadRitisConfig', () => {
  it('reads + validates a config file at the given path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ritis-'));
    const p = join(dir, 'ritis.config.json');
    writeFileSync(p, JSON.stringify(full));
    expect(loadRitisConfig(p)).toEqual(full);
  });
  it('throws a helpful error when the file is missing', () => {
    expect(() => loadRitisConfig(join(tmpdir(), 'does-not-exist-ritis.json')))
      .toThrow(/ritis\.config\.json/i);
  });
});
