#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { buildArtifactTemplate } = require('./lib/templates');
const {
  appendHookLog,
  ensureHandoffFile,
  ensureRuntimeDirs,
  getArtifactPath,
  getProjectRoot,
  updateRuntimeTask,
  updateStateTask,
  writeText,
} = require('./lib/runtime');

function parseArgs(argv) {
  const options = {
    artifactKind: '',
    taskSlug: '',
    merge: null,
    mergeFile: '',
    meta: null,
    metaFile: '',
    readFromStdin: false,
    ensureTemplate: false,
    useTemplate: false,
  };

  const [artifactKind, taskSlug, ...rest] = argv;
  options.artifactKind = String(artifactKind || '').trim();
  options.taskSlug = String(taskSlug || '').trim();

  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (value === '--merge') {
      options.merge = rest[index + 1] || '';
      index += 1;
    } else if (value === '--merge-file') {
      options.mergeFile = rest[index + 1] || '';
      index += 1;
    } else if (value === '--meta') {
      options.meta = rest[index + 1] || '';
      index += 1;
    } else if (value === '--meta-file') {
      options.metaFile = rest[index + 1] || '';
      index += 1;
    } else if (value === '--stdin') {
      options.readFromStdin = true;
    } else if (value === '--ensure-template') {
      options.ensureTemplate = true;
    } else if (value === '--template') {
      options.useTemplate = true;
    }
  }

  return options;
}

function readStdin() {
  return new Promise(resolve => {
    let raw = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      raw += chunk;
    });
    process.stdin.on('end', () => resolve(raw));
    process.stdin.on('error', () => resolve(raw));
  });
}

function parseMergePatch(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`invalid JSON for --merge: ${error.message}`);
  }
}

function readMergeFile(mergeFile) {
  if (!mergeFile) return '';
  const filePath = path.resolve(mergeFile);
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`cannot read --merge-file ${mergeFile}: ${error.message}`);
  }
}

function parseMeta(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`invalid JSON for --meta: ${error.message}`);
  }
}

function readMetaFile(metaFile) {
  if (!metaFile) return '';
  const filePath = path.resolve(metaFile);
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`cannot read --meta-file ${metaFile}: ${error.message}`);
  }
}

function ensureValidKind(artifactKind) {
  const allowedKinds = new Set([
    'state',
    'runtime',
    'handoff',
    'review',
    'requirements',
    'plan',
    'verification',
  ]);

  if (!allowedKinds.has(artifactKind)) {
    throw new Error(`unsupported artifact kind: ${artifactKind}`);
  }
}

async function main() {
  const projectRoot = getProjectRoot();
  ensureRuntimeDirs(projectRoot);

  const options = parseArgs(process.argv.slice(2));
  ensureValidKind(options.artifactKind);

  if (!options.taskSlug) {
    throw new Error('task slug is required');
  }

  if (options.artifactKind === 'state' || options.artifactKind === 'runtime') {
    const mergeSource = options.mergeFile ? readMergeFile(options.mergeFile) : options.merge;
    const patch = parseMergePatch(mergeSource);
    const value = options.artifactKind === 'state'
      ? updateStateTask(projectRoot, options.taskSlug, patch)
      : updateRuntimeTask(projectRoot, options.taskSlug, patch);

    appendHookLog(
      projectRoot,
      `artifact-writer kind=${options.artifactKind} task=${options.taskSlug} mode=merge`
    );

    process.stdout.write(`${JSON.stringify({
      artifact_kind: options.artifactKind,
      task_slug: options.taskSlug,
      path: getArtifactPath(projectRoot, options.taskSlug, options.artifactKind),
      value,
    }, null, 2)}\n`);
    return;
  }

  if (options.artifactKind === 'handoff' && options.ensureTemplate) {
    ensureHandoffFile(projectRoot, options.taskSlug);
    process.stdout.write(`${getArtifactPath(projectRoot, options.taskSlug, 'handoff')}\n`);
    return;
  }

  if (options.useTemplate) {
    const artifactPath = getArtifactPath(projectRoot, options.taskSlug, options.artifactKind);
    if (!artifactPath) {
      throw new Error(`cannot resolve artifact path for ${options.artifactKind}`);
    }

    const metaSource = options.metaFile ? readMetaFile(options.metaFile) : options.meta;
    const meta = parseMeta(metaSource);
    const content = buildArtifactTemplate(options.artifactKind, options.taskSlug, meta);
    writeText(artifactPath, content);
    appendHookLog(
      projectRoot,
      `artifact-writer kind=${options.artifactKind} task=${options.taskSlug} mode=template`
    );

    process.stdout.write(`${artifactPath}\n`);
    return;
  }

  if (!options.readFromStdin) {
    throw new Error(
      `artifact kind ${options.artifactKind} requires --stdin, --template, or --ensure-template`
    );
  }

  const content = await readStdin();
  const artifactPath = getArtifactPath(projectRoot, options.taskSlug, options.artifactKind);
  if (!artifactPath) {
    throw new Error(`cannot resolve artifact path for ${options.artifactKind}`);
  }

  writeText(artifactPath, content);
  appendHookLog(
    projectRoot,
    `artifact-writer kind=${options.artifactKind} task=${options.taskSlug} mode=replace`
  );

  process.stdout.write(`${artifactPath}\n`);
}

main().catch(error => {
  process.stderr.write(`[oh-imean] write-artifact failed: ${error.message}\n`);
  process.exit(1);
});
