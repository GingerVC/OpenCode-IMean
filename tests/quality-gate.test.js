'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = path.resolve(__dirname, '..', 'scripts', 'hooks', 'quality-gate.js');

function createTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'oh-imean-quality-gate-'));
}

function writeExecutable(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  fs.chmodSync(filePath, 0o755);
}

test('quality gate hook honors strict mode failures', () => {
  const projectRoot = createTempProject();
  const fakeBinDir = path.join(projectRoot, 'fake-bin');
  const sourceFile = path.join(projectRoot, 'src', 'app.js');

  fs.mkdirSync(path.dirname(sourceFile), { recursive: true });
  fs.writeFileSync(sourceFile, 'const broken = true;\n', 'utf8');

  writeExecutable(
    path.join(fakeBinDir, 'npx'),
    '#!/usr/bin/env sh\nprintf "mock prettier failure\\n" >&2\nexit 1\n'
  );

  const result = spawnSync(process.execPath, [SCRIPT_PATH], {
    cwd: projectRoot,
    input: JSON.stringify({
      tool_name: 'Edit',
      tool_input: {
        file_path: 'src/app.js',
      },
    }),
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${fakeBinDir}:${process.env.PATH}`,
      OH_IMEAN_QUALITY_GATE_STRICT: 'true',
    },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[quality-gate\] warning: prettier/);
});
