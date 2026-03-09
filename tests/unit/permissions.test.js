'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const tmpDir = path.join(os.tmpdir(), `a2a-perm-test-${Date.now()}`);
fs.mkdirSync(tmpDir, { recursive: true });
process.env.A2A_CONFIG_DIR = tmpDir;

const { checkPermission, getAllPermissions } = require('../../src/permissions');

describe('Permissions', () => {
  afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  describe('no permissions.json (Phase 1 default)', () => {
    test('allows all peers all skills', () => {
      expect(checkPermission('any-peer', 'ping').allowed).toBe(true);
      expect(checkPermission('any-peer', 'get_status').allowed).toBe(true);
      expect(checkPermission('unknown', 'anything').allowed).toBe(true);
    });

    test('getAllPermissions returns default allow', () => {
      const perms = getAllPermissions();
      expect(perms.default).toBe('allow');
    });
  });

  describe('with permissions.json', () => {
    beforeAll(() => {
      fs.writeFileSync(path.join(tmpDir, 'permissions.json'), JSON.stringify({
        default: 'deny',
        permissions: {
          'laptop': ['ping', 'get_status', 'analyze_pdf'],
          'phone': ['ping'],
          'admin': ['*'],
        },
      }));
    });

    test('allows peer with matching skill', () => {
      expect(checkPermission('laptop', 'ping').allowed).toBe(true);
      expect(checkPermission('laptop', 'analyze_pdf').allowed).toBe(true);
    });

    test('denies peer without matching skill', () => {
      const result = checkPermission('phone', 'analyze_pdf');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not authorized');
    });

    test('wildcard allows all skills', () => {
      expect(checkPermission('admin', 'anything').allowed).toBe(true);
      expect(checkPermission('admin', 'secret_skill').allowed).toBe(true);
    });

    test('unknown peer denied when default is deny', () => {
      const result = checkPermission('stranger', 'ping');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('no permissions configured');
    });
  });
});
