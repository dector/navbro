const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const root = path.resolve(__dirname, '..');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'navbro-release-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'tools'));
  for (const name of ['release.sh', 'publish.sh', 'push-updates.sh', 'update-metadata.py']) {
    fs.copyFileSync(path.join(root, 'tools', name), path.join(dir, 'tools', name));
  }
  return dir;
}
function run(dir, cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { cwd: dir, encoding: 'utf8', ...options });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.stdout.trim();
}
function manifest(dir, version) {
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
    name: 'navbro', version,
    browser_specific_settings: { gecko: { id: 'navbro@dector.space' } },
  }));
}
function init(dir) {
  run(dir, 'git', ['init', '-b', 'main']);
  run(dir, 'git', ['config', 'user.name', 'Test']);
  run(dir, 'git', ['config', 'user.email', 'test@example.com']);
  run(dir, 'git', ['add', '.']);
  run(dir, 'git', ['commit', '-m', 'test: initial']);
}
const url = v => `https://github.com/dector/navbro/releases/download/v${v}/navbro-${v}-signed.xpi`;

test('release commits, tags exact release, commits next snapshot, and pushes both refs', t => {
  const dir = fixture(t);
  manifest(dir, '0.0.9-snapshot');
  fs.writeFileSync(path.join(dir, 'build'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  init(dir);
  const remote = path.join(dir, '.git', 'remote.git');
  run(dir, 'git', ['init', '--bare', remote]);
  run(dir, 'git', ['remote', 'add', 'origin', remote]);
  run(dir, 'bash', ['tools/release.sh'], { input: 'y\n\ny\ny\n' });
  assert.equal(JSON.parse(run(dir, 'git', ['show', 'v0.0.9:manifest.json'])).version, '0.0.9');
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'))).version, '0.0.10-snapshot');
  assert.equal(run(dir, 'git', ['rev-parse', 'HEAD~1']), run(dir, 'git', ['rev-parse', 'v0.0.9^{}']));
  assert.match(run(dir, 'git', ['ls-remote', 'origin']), /refs\/tags\/v0.0.9/);
  assert.match(run(dir, 'git', ['ls-remote', 'origin']), /refs\/heads\/main/);
});

test('release refusing push keeps commits/tag local, and rejects dirty tree', t => {
  const dir = fixture(t);
  manifest(dir, '1.0.0-snapshot');
  fs.writeFileSync(path.join(dir, 'build'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  init(dir);
  run(dir, 'bash', ['tools/release.sh'], { input: 'y\n\ny\nn\n' });
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'))).version, '1.0.1-snapshot');
  fs.writeFileSync(path.join(dir, 'untracked'), 'dirty');
  const result = spawnSync('bash', ['tools/release.sh'], { cwd: dir, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /not clean/);
});

test('updates branch is bootstrapped; numeric versions prevent rollback; unrelated files survive', t => {
  const dir = fixture(t);
  manifest(dir, '0.0.10');
  fs.writeFileSync(path.join(dir, 'signed.xpi'), 'signed bytes');
  init(dir);
  run(dir, 'git', ['init', '--bare', path.join(dir, 'remote.git')]);
  run(dir, 'git', ['remote', 'add', 'origin', path.join(dir, 'remote.git')]);
  run(dir, 'bash', ['tools/push-updates.sh', 'signed.xpi', url('0.0.10')]);
  const data = JSON.parse(run(dir, 'git', ['--git-dir=remote.git', 'show', 'updates:updates.json']));
  const entry = data.addons['navbro@dector.space'].updates[0];
  assert.equal(entry.version, '0.0.10');
  assert.match(entry.update_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(run(dir, 'git', ['--git-dir=remote.git', 'ls-tree', '--name-only', 'updates']), 'updates.json');
  const initial = run(dir, 'git', ['--git-dir=remote.git', 'rev-parse', 'updates']);
  manifest(dir, '0.0.9');
  run(dir, 'bash', ['tools/push-updates.sh', 'signed.xpi', url('0.0.9')]);
  assert.equal(run(dir, 'git', ['--git-dir=remote.git', 'rev-parse', 'updates']), initial);
  const checkout = path.join(dir, 'updates-checkout');
  run(dir, 'git', ['clone', '--branch', 'updates', path.join(dir, 'remote.git'), checkout]);
  run(checkout, 'git', ['config', 'user.name', 'Test']);
  run(checkout, 'git', ['config', 'user.email', 'test@example.com']);
  fs.writeFileSync(path.join(checkout, 'keep.txt'), 'keep');
  run(checkout, 'git', ['add', '.']);
  run(checkout, 'git', ['commit', '-m', 'test: keep']);
  run(checkout, 'git', ['push']);
  manifest(dir, '0.1.0');
  run(dir, 'bash', ['tools/push-updates.sh', 'signed.xpi', url('0.1.0')]);
  assert.equal(run(dir, 'git', ['--git-dir=remote.git', 'show', 'updates:keep.txt']), 'keep');
  assert.equal(run(dir, 'git', ['branch', '--show-current']), 'main');
});

test('CI publish fails loudly when credentials are missing', t => {
  const dir = fixture(t);
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'web-ext'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const result = spawnSync('bash', ['tools/publish.sh', '1.0.0'], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, CI: 'true', AMO_JWT_ISSUER: '', AMO_JWT_SECRET: '' },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /AMO_JWT_ISSUER and AMO_JWT_SECRET are required/);
});

test('CI publish selects exact version without fzf and keeps signed package', t => {
  const dir = fixture(t);
  manifest(dir, '1.2.3');
  fs.mkdirSync(path.join(dir, 'dist'));
  run(dir, 'zip', ['-q', 'dist/navbro-1.2.3.xpi', 'manifest.json']);
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'web-ext'), `#!/usr/bin/env python3
import sys, os, zipfile
args = sys.argv
assert os.environ['WEB_EXT_API_KEY'] == 'fake-key'
assert os.environ['WEB_EXT_API_SECRET'] == 'fake-secret'
assert '--api-secret' not in args
source = args[args.index('--source-dir') + 1]
artifacts = args[args.index('--artifacts-dir') + 1]
with zipfile.ZipFile(artifacts + '/signed.xpi', 'w') as z:
    z.write(source + '/manifest.json', 'manifest.json')
    z.writestr('META-INF/mozilla.rsa', 'mock signature')
`, { mode: 0o755 });
  const output = run(dir, 'bash', ['tools/publish.sh', '1.2.3'], {
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, CI: 'true', AMO_JWT_ISSUER: 'fake-key', AMO_JWT_SECRET: 'fake-secret' },
  });
  assert.ok(fs.existsSync(path.join(dir, 'dist/navbro-1.2.3-signed.xpi')));
  assert.doesNotMatch(output, /fake-secret/);
});
