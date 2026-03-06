'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildHandoffTemplate } = require('./templates');

const SPECS_DIR = '.oh-imean/specs';
const RUNTIME_DIR = '.oh-imean/runtime';
const RUNTIME_TASKS_DIR = '.oh-imean/runtime/tasks';
const RUNTIME_SESSIONS_DIR = '.oh-imean/runtime/sessions';
const RUNTIME_LOGS_DIR = '.oh-imean/runtime/logs';

function getProjectRoot(cwd = process.cwd()) {
  return cwd;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensureRuntimeDirs(projectRoot) {
  ensureDir(path.join(projectRoot, RUNTIME_DIR));
  ensureDir(path.join(projectRoot, RUNTIME_TASKS_DIR));
  ensureDir(path.join(projectRoot, RUNTIME_SESSIONS_DIR));
  ensureDir(path.join(projectRoot, RUNTIME_LOGS_DIR));
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function writeText(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, value, 'utf8');
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function getSpecsRoot(projectRoot) {
  return path.join(projectRoot, SPECS_DIR);
}

function getRuntimeTaskPath(projectRoot, taskSlug) {
  return path.join(projectRoot, RUNTIME_TASKS_DIR, `${taskSlug}.json`);
}

function getTaskPaths(projectRoot, taskSlug) {
  const base = path.join(getSpecsRoot(projectRoot), taskSlug);
  return {
    base,
    state: path.join(base, 'state.json'),
    requirements: path.join(base, 'requirements.md'),
    plan: path.join(base, 'plan.md'),
    review: path.join(base, 'review.md'),
    verification: path.join(base, 'verification.md'),
    handoff: path.join(base, 'handoff.md'),
    runtime: getRuntimeTaskPath(projectRoot, taskSlug),
  };
}

function getArtifactPath(projectRoot, taskSlug, artifactKind) {
  const paths = getTaskPaths(projectRoot, taskSlug);
  switch (artifactKind) {
    case 'state':
      return paths.state;
    case 'requirements':
      return paths.requirements;
    case 'plan':
      return paths.plan;
    case 'review':
      return paths.review;
    case 'verification':
      return paths.verification;
    case 'handoff':
      return paths.handoff;
    case 'runtime':
      return paths.runtime;
    default:
      return null;
  }
}

function listTaskDirs(projectRoot) {
  const specsRoot = getSpecsRoot(projectRoot);
  if (!fileExists(specsRoot)) return [];

  return fs.readdirSync(specsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(specsRoot, entry.name));
}

function getFileMtime(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

function collectTasks(projectRoot) {
  return listTaskDirs(projectRoot)
    .map(dirPath => {
      const taskSlug = path.basename(dirPath);
      const paths = getTaskPaths(projectRoot, taskSlug);
      const state = readJson(paths.state);
      const runtime = readJson(paths.runtime);

      if (!state) return null;

      return {
        taskSlug,
        paths,
        state,
        runtime,
        updatedAt: Math.max(
          getFileMtime(paths.state),
          getFileMtime(paths.handoff),
          getFileMtime(paths.runtime),
          getFileMtime(paths.review),
          getFileMtime(paths.verification),
          getFileMtime(paths.plan)
        ),
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

function isActiveState(state) {
  if (!state || !state.mode) return false;
  if (state.phase === 'done') return false;
  return ['active', 'waiting_user', 'blocked'].includes(String(state.status || ''));
}

function getLatestUserGoalFromTranscript(transcriptPath) {
  const content = readText(transcriptPath);
  if (!content) return '';

  let latestGoal = '';
  for (const line of content.split('\n').filter(Boolean)) {
    try {
      const entry = JSON.parse(line);
      const rawContent = entry.message?.content ?? entry.content;
      const text = typeof rawContent === 'string'
        ? rawContent
        : Array.isArray(rawContent)
          ? rawContent.map(item => item?.text || '').join(' ')
          : '';

      if ((entry.type === 'user' || entry.role === 'user' || entry.message?.role === 'user') && text.trim()) {
        latestGoal = text.trim();
      }
    } catch {
      // Ignore malformed transcript lines.
    }
  }

  return latestGoal;
}

function detectModeFromTranscript(transcriptPath) {
  if (!transcriptPath) return null;
  const latestGoal = getLatestUserGoalFromTranscript(transcriptPath);
  if (!latestGoal) return null;
  return detectModeFromGoal(latestGoal);
}

function getLatestTask(projectRoot) {
  const tasks = collectTasks(projectRoot);
  return tasks.find(task => isActiveState(task.state)) || tasks[0] || null;
}

function detectModeFromGoal(text) {
  const source = String(text || '').toLowerCase();
  if (!source) return 'standardized';

  const quickFixSignals = [
    'bug',
    'fix',
    '报错',
    '修复',
    '错误',
    '异常',
    'hotfix',
  ];

  return quickFixSignals.some(signal => source.includes(signal))
    ? 'quick-fix'
    : 'standardized';
}

function getRecommendedNextCommand(task) {
  if (!task || !task.state) {
    return '/dispatch <需求>';
  }

  const state = task.state;
  const taskSlug = task.taskSlug;
  const option = state.selected_option ? ` ${state.selected_option}` : '';

  switch (state.phase) {
    case 'intake':
      return state.mode === 'quick-fix'
        ? `/kickoff ${taskSlug}`
        : `/plan ${taskSlug}`;
    case 'spec':
    case 'plan':
      return `/plan ${taskSlug}`;
    case 'implement':
      return `/kickoff ${taskSlug}${option}`.trim();
    case 'review':
      return `/review ${taskSlug}`;
    case 'verify':
      return `/verify ${taskSlug}`;
    case 'done':
      return `/dispatch <新需求>`;
    default:
      return '/dispatch <需求>';
  }
}

function updateRuntimeTask(projectRoot, taskSlug, patch) {
  if (!taskSlug) return null;

  const runtimePath = getRuntimeTaskPath(projectRoot, taskSlug);
  const current = readJson(runtimePath) || { task_slug: taskSlug };
  const next = {
    ...current,
    ...patch,
    task_slug: taskSlug,
    updated_at: new Date().toISOString(),
  };

  writeJson(runtimePath, next);
  return next;
}

function updateStateTask(projectRoot, taskSlug, patch) {
  if (!taskSlug) return null;

  const statePath = getArtifactPath(projectRoot, taskSlug, 'state');
  const current = readJson(statePath) || { task_slug: taskSlug };
  const next = {
    ...current,
    ...patch,
    task_slug: taskSlug,
    updated_at: new Date().toISOString(),
  };

  writeJson(statePath, next);
  return next;
}

function getDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function getTimestampString(date = new Date()) {
  return date.toISOString();
}

function getSessionId(value) {
  const source = String(value || '').trim();
  if (!source) {
    return crypto.randomBytes(6).toString('hex');
  }

  return crypto.createHash('sha1').update(source).digest('hex').slice(0, 12);
}

function getSessionFilePath(projectRoot, sessionId, date = new Date()) {
  return path.join(
    projectRoot,
    RUNTIME_SESSIONS_DIR,
    `${getDateString(date)}-${sessionId}.md`
  );
}

function getCompactSnapshotPath(projectRoot, sessionId, date = new Date()) {
  return path.join(
    projectRoot,
    RUNTIME_LOGS_DIR,
    `pre-compact-${getDateString(date)}-${sessionId}.json`
  );
}

function appendHookLog(projectRoot, message) {
  ensureRuntimeDirs(projectRoot);
  const logPath = path.join(projectRoot, RUNTIME_LOGS_DIR, 'oh-imean-hook.log');
  const line = `[${getTimestampString()}] ${message}\n`;
  fs.appendFileSync(logPath, line, 'utf8');
}

function ensureHandoffFile(projectRoot, taskSlug) {
  if (!taskSlug) return;
  const { handoff } = getTaskPaths(projectRoot, taskSlug);
  if (!fileExists(handoff)) {
    writeText(handoff, buildHandoffTemplate(taskSlug));
  }
}

module.exports = {
  RUNTIME_DIR,
  RUNTIME_LOGS_DIR,
  RUNTIME_SESSIONS_DIR,
  RUNTIME_TASKS_DIR,
  appendHookLog,
  collectTasks,
  detectModeFromGoal,
  ensureDir,
  ensureHandoffFile,
  ensureRuntimeDirs,
  fileExists,
  getArtifactPath,
  getCompactSnapshotPath,
  getDateString,
  getLatestTask,
  getLatestUserGoalFromTranscript,
  getProjectRoot,
  getRecommendedNextCommand,
  getRuntimeTaskPath,
  getSessionFilePath,
  getSessionId,
  getTaskPaths,
  getTimestampString,
  detectModeFromTranscript,
  isActiveState,
  readJson,
  readText,
  updateStateTask,
  updateRuntimeTask,
  writeJson,
  writeText,
};
