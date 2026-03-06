'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = path.resolve(__dirname, '..', 'scripts', 'build-template-meta.js');

function createTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'oh-imean-meta-'));
}

function runNode(args, options = {}) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    cwd: options.cwd,
    encoding: 'utf8',
    env: process.env,
  });
}

test('build-template-meta writes dispatch handoff meta file with semantic flags', () => {
  const projectRoot = createTempProject();
  const outPath = path.join(projectRoot, 'dispatch-handoff.json');

  const result = runNode([
    'dispatch-handoff',
    'demo-task',
    '--phase', 'intake',
    '--from-role', 'dispatcher',
    '--to-role', 'spec-planner',
    '--next-action', '运行 /plan demo-task',
    '--assumption', '需求范围尚未锁定',
    '--out', outPath,
  ], { cwd: projectRoot });

  assert.equal(result.status, 0, result.stderr);

  const content = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.equal(content.phase, 'intake');
  assert.equal(content.from_role, 'dispatcher');
  assert.equal(content.to_role, 'spec-planner');
  assert.equal(content.next_action, '运行 /plan demo-task');
  assert.deepEqual(content.assumptions, ['需求范围尚未锁定']);
});

test('build-template-meta writes verification report meta with repeated flags', () => {
  const projectRoot = createTempProject();
  const outPath = path.join(projectRoot, 'verification.json');

  const result = runNode([
    'verify-report',
    'demo-task',
    '--status', 'pass_with_risk',
    '--summary', '核心验证通过。',
    '--check-run', 'npm test',
    '--check-run', 'npm run lint',
    '--coverage', 'Requirement 1: 已覆盖',
    '--risk', '缺少高并发验证',
    '--next-step', '补压测后关闭任务',
    '--walkthrough', '先运行自动化测试，再抽样手测。',
    '--out', outPath,
  ], { cwd: projectRoot });

  assert.equal(result.status, 0, result.stderr);

  const content = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.equal(content.status, 'pass_with_risk');
  assert.deepEqual(content.checks_run, ['npm test', 'npm run lint']);
  assert.deepEqual(content.requirement_coverage, ['Requirement 1: 已覆盖']);
  assert.deepEqual(content.risks, ['缺少高并发验证']);
});

test('build-template-meta writes review report meta with repeated flags', () => {
  const projectRoot = createTempProject();
  const outPath = path.join(projectRoot, 'review.json');

  const result = runNode([
    'review-report',
    'demo-task',
    '--finding', '[Medium] 缺少锁定状态测试',
    '--alignment', 'Requirement 1: 部分满足',
    '--regression-risk', '登录错误提示可能回退',
    '--testing-gap', '缺少集成测试',
    '--recommendation', '返回 implement 补测试',
    '--out', outPath,
  ], { cwd: projectRoot });

  assert.equal(result.status, 0, result.stderr);

  const content = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.deepEqual(content.findings, ['[Medium] 缺少锁定状态测试']);
  assert.deepEqual(content.requirement_alignment, ['Requirement 1: 部分满足']);
  assert.deepEqual(content.regression_risks, ['登录错误提示可能回退']);
  assert.deepEqual(content.testing_gaps, ['缺少集成测试']);
  assert.equal(content.recommendation, '返回 implement 补测试');
});

test('build-template-meta writes dispatch state patch with required workflow fields', () => {
  const projectRoot = createTempProject();
  const outPath = path.join(projectRoot, 'dispatch-state.json');

  const result = runNode([
    'dispatch-state',
    'demo-task',
    '--mode', 'standardized',
    '--phase', 'intake',
    '--status', 'active',
    '--current-role', 'dispatcher',
    '--next-role', 'spec-planner',
    '--uncertainty', 'medium',
    '--goal', '给登录接口增加限流能力',
    '--recommended-next-command', '/plan demo-task',
    '--out', outPath,
  ], { cwd: projectRoot });

  assert.equal(result.status, 0, result.stderr);

  const content = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.equal(content.mode, 'standardized');
  assert.equal(content.phase, 'intake');
  assert.equal(content.current_role, 'dispatcher');
  assert.equal(content.next_role, 'spec-planner');
  assert.equal(content.uncertainty_level, 'medium');
  assert.equal(content.current_goal, '给登录接口增加限流能力');
});

test('build-template-meta writes verify runtime patch with recommendation and status', () => {
  const projectRoot = createTempProject();
  const outPath = path.join(projectRoot, 'verify-runtime.json');

  const result = runNode([
    'verify-runtime',
    'demo-task',
    '--phase', 'verify',
    '--verification-status', 'pass_with_risk',
    '--recommended-next-command', '/dispatch <新需求>',
    '--last-blocking-reason', '缺少压测证据',
    '--selected-option', 'P2 - 平衡方案',
    '--active-step', '执行最终验证',
    '--out', outPath,
  ], { cwd: projectRoot });

  assert.equal(result.status, 0, result.stderr);

  const content = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.equal(content.phase, 'verify');
  assert.equal(content.verification_status, 'pass_with_risk');
  assert.equal(content.recommended_next_command, '/dispatch <新需求>');
  assert.equal(content.last_blocking_reason, '缺少压测证据');
  assert.equal(content.selected_option, 'P2 - 平衡方案');
});

test('build-template-meta writes review state/runtime patches', () => {
  const projectRoot = createTempProject();
  const statePath = path.join(projectRoot, 'review-state.json');
  const runtimePath = path.join(projectRoot, 'review-runtime.json');

  const stateResult = runNode([
    'review-state',
    'demo-task',
    '--phase', 'review',
    '--status', 'blocked',
    '--current-role', 'reviewer',
    '--next-role', 'implementer',
    '--verification-status', 'pending',
    '--last-blocking-reason', '缺少锁定状态测试',
    '--recommended-next-command', '/kickoff demo-task',
    '--out', statePath,
  ], { cwd: projectRoot });
  assert.equal(stateResult.status, 0, stateResult.stderr);

  const runtimeResult = runNode([
    'review-runtime',
    'demo-task',
    '--phase', 'review',
    '--verification-status', 'pending',
    '--last-blocking-reason', '缺少锁定状态测试',
    '--recommended-next-command', '/review demo-task',
    '--selected-option', 'P2 - 平衡方案',
    '--active-step', '独立审查实现结果',
    '--out', runtimePath,
  ], { cwd: projectRoot });
  assert.equal(runtimeResult.status, 0, runtimeResult.stderr);

  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const runtime = JSON.parse(fs.readFileSync(runtimePath, 'utf8'));

  assert.equal(state.phase, 'review');
  assert.equal(state.current_role, 'reviewer');
  assert.equal(state.next_role, 'implementer');
  assert.equal(runtime.phase, 'review');
  assert.equal(runtime.recommended_next_command, '/review demo-task');
});

test('build-template-meta writes plan implementation meta with execution boundary and split checks', () => {
  const projectRoot = createTempProject();
  const outPath = path.join(projectRoot, 'plan-implementation.json');

  const result = runNode([
    'plan-implementation',
    'demo-task',
    '--goal', '改进登录流程稳定性',
    '--selected-option', 'P2 - 平衡方案',
    '--execution-boundary', '仅改登录相关模块，不改全局鉴权架构',
    '--change', '[MODIFY] src/auth/login.ts',
    '--step', '实现限流',
    '--automated-check', 'npm test',
    '--manual-check', '登录成功/失败手测',
    '--replan-trigger', '发现 schema 与计划不一致',
    '--out', outPath,
  ], { cwd: projectRoot });

  assert.equal(result.status, 0, result.stderr);

  const content = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.equal(content.execution_boundary, '仅改登录相关模块，不改全局鉴权架构');
  assert.deepEqual(content.automated_checks, ['npm test']);
  assert.deepEqual(content.manual_smoke_checks, ['登录成功/失败手测']);
});

test('build-template-meta writes verify state patch with last_verified_at and discarded_context_summary', () => {
  const projectRoot = createTempProject();
  const outPath = path.join(projectRoot, 'verify-state.json');

  const result = runNode([
    'verify-state',
    'demo-task',
    '--phase', 'done',
    '--verification-status', 'pass',
    '--last-verified-at', '2026-03-06T12:00:00.000Z',
    '--discarded-context-summary', '丢弃无关日志，仅保留验证证据',
    '--out', outPath,
  ], { cwd: projectRoot });

  assert.equal(result.status, 0, result.stderr);

  const content = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.equal(content.last_verified_at, '2026-03-06T12:00:00.000Z');
  assert.equal(content.discarded_context_summary, '丢弃无关日志，仅保留验证证据');
});
