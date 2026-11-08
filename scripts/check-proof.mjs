import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const status = readFileSync('/proc/self/status', 'utf8');
assert.equal(BigInt('0x' + status.match(/^CapEff:\s*(\w+)/m)[1]), 0n);
assert.equal(status.match(/^NoNewPrivs:\s*(\d+)/m)[1], '1');
assert.equal(existsSync('/home/martin'), false);
function run(args) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', timeout: 150000 });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, 'Command failed: ' + args.join(' '));
}
run(['node_modules/vite/bin/vite.js', 'build', '--configLoader', 'native', '--ssr', 'src/App.jsx', '--outDir', '.test-build']);
run(['--test', '--test-concurrency=1', ...readdirSync('tests').filter(n => /\.test\.(?:m?js)$/.test(n)).map(n => 'tests/' + n)]);
if (existsSync('/acceptance')) {
  run(['--test', '--test-concurrency=1', '/acceptance/engine.acceptance.mjs', '/acceptance/backup-roundtrip.acceptance.mjs']);
}
run(['node_modules/vite/bin/vite.js', 'build', '--configLoader', 'native']);
for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.md', ...readdirSync('licenses').map(n => 'licenses/' + n)]) {
  assert.deepEqual(readFileSync('dist/' + name), readFileSync(name), 'Distribution license differs: ' + name);
}
assert.match(readFileSync('dist/index.html', 'utf8'), /33dbf561/);
console.log('Offline tests, source isolation and distribution licenses passed.');
