'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = path.resolve(__dirname, '..', 'scripts', 'write-artifact.js');

function createTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'oh-imean-artifact-'));
}

function runNode(args, options = {}) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    cwd: options.cwd,
    input: options.input,
    encoding: 'utf8',
    env: process.env,
  });
}

test('artifact writer merges state and runtime JSON artifacts', () => {
  const projectRoot = createTempProject();

  const stateResult = runNode(
    ['state', 'demo-task', '--merge', '{"mode":"standardized","phase":"plan","status":"active"}'],
    { cwd: projectRoot },
  );
  assert.equal(stateResult.status, 0, stateResult.stderr);

  const runtimeResult = runNode(
    ['runtime', 'demo-task', '--merge', '{"recommended_next_command":"/plan demo-task","verification_status":"pending"}'],
    { cwd: projectRoot },
  );
  assert.equal(runtimeResult.status, 0, runtimeResult.stderr);

  const statePath = path.join(projectRoot, '.oh-imean', 'specs', 'demo-task', 'state.json');
  const runtimePath = path.join(projectRoot, '.oh-imean', 'runtime', 'tasks', 'demo-task.json');

  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const runtime = JSON.parse(fs.readFileSync(runtimePath, 'utf8'));

  assert.equal(state.mode, 'standardized');
  assert.equal(state.phase, 'plan');
  assert.equal(state.status, 'active');
  assert.equal(state.task_slug, 'demo-task');

  assert.equal(runtime.recommended_next_command, '/plan demo-task');
  assert.equal(runtime.verification_status, 'pending');
  assert.equal(runtime.task_slug, 'demo-task');
});

test('artifact writer writes markdown artifacts from stdin', () => {
  const projectRoot = createTempProject();
  const body = '# Verification Report\n\n## Status\npass\n';

  const result = runNode(
    ['verification', 'demo-task', '--stdin'],
    { cwd: projectRoot, input: body },
  );
  assert.equal(result.status, 0, result.stderr);

  const verificationPath = path.join(projectRoot, '.oh-imean', 'specs', 'demo-task', 'verification.md');
  assert.equal(fs.readFileSync(verificationPath, 'utf8'), body);
});

test('artifact writer generates requirements template from metadata', () => {
  const projectRoot = createTempProject();

  const result = runNode(
    [
      'requirements',
      'demo-task',
      '--template',
      '--meta',
      JSON.stringify({
        introduction: '为登录接口补齐限流与错误提示。',
        scope: ['登录接口', '错误提示文案'],
        non_goals: ['重写整个认证模块'],
        constraints: ['保持现有 API 兼容'],
        assumptions: ['Redis 已可用'],
        requirements: [
          {
            title: '限制连续失败登录',
            user_story: '作为系统管理员，我希望限制连续失败登录以减少爆破风险。',
            acceptance_criteria: [
              'WHEN 同一账号连续失败达到阈值 THEN 系统 SHALL 拒绝后续登录尝试一段时间',
            ],
          },
        ],
      }),
    ],
    { cwd: projectRoot },
  );
  assert.equal(result.status, 0, result.stderr);

  const requirementsPath = path.join(projectRoot, '.oh-imean', 'specs', 'demo-task', 'requirements.md');
  const content = fs.readFileSync(requirementsPath, 'utf8');

  assert.match(content, /# Requirements Document/);
  assert.match(content, /## Introduction/);
  assert.match(content, /## Requirements/);
  assert.match(content, /### Requirement 1 - 限制连续失败登录/);
  assert.match(content, /\*\*User Story:\*\* 作为系统管理员/);
  assert.match(content, /#### Acceptance Criteria/);
});

test('artifact writer generates plan and verification templates from metadata', () => {
  const projectRoot = createTempProject();

  const planResult = runNode(
    [
      'plan',
      'demo-task',
      '--template',
      '--meta',
      JSON.stringify({
        goal: '给登录流程增加限流能力',
        selected_option: 'P2 - 平衡方案',
        linked_artifacts: [
          '.oh-imean/specs/demo-task/requirements.md',
        ],
        proposed_changes: [
          '[MODIFY] src/login.ts - 增加失败计数与锁定判断',
        ],
        execution_steps: [
          '补充失败计数持久化',
          '接入登录前置校验',
        ],
        verification_plan: [
          '运行登录相关单元测试',
        ],
        replan_triggers: [
          '现有登录流程没有统一入口',
        ],
      }),
    ],
    { cwd: projectRoot },
  );
  assert.equal(planResult.status, 0, planResult.stderr);

  const verificationResult = runNode(
    [
      'verification',
      'demo-task',
      '--template',
      '--meta',
      JSON.stringify({
        status: 'pass_with_risk',
        summary: '核心限流路径通过，回归覆盖不足。',
        checks_run: ['npm test -- login'],
        requirement_coverage: ['Requirement 1: 已覆盖'],
        risks: ['缺少高并发压测'],
        recommended_next_step: '补一组并发场景验证',
        walkthrough: '先跑登录测试，再手工验证锁定逻辑。',
      }),
    ],
    { cwd: projectRoot },
  );
  assert.equal(verificationResult.status, 0, verificationResult.stderr);

  const planPath = path.join(projectRoot, '.oh-imean', 'specs', 'demo-task', 'plan.md');
  const verificationPath = path.join(projectRoot, '.oh-imean', 'specs', 'demo-task', 'verification.md');
  const planContent = fs.readFileSync(planPath, 'utf8');
  const verificationContent = fs.readFileSync(verificationPath, 'utf8');

  assert.match(planContent, /# Implementation Plan/);
  assert.match(planContent, /## Selected Option/);
  assert.match(planContent, /P2 - 平衡方案/);
  assert.match(planContent, /\[MODIFY\] src\/login.ts/);

  assert.match(verificationContent, /# Verification Report/);
  assert.match(verificationContent, /## Status/);
  assert.match(verificationContent, /pass_with_risk/);
  assert.match(verificationContent, /## Walkthrough/);
});

test('artifact writer supports metadata from file', () => {
  const projectRoot = createTempProject();
  const metaPath = path.join(projectRoot, 'verification-meta.json');

  fs.writeFileSync(metaPath, JSON.stringify({
    status: 'pass',
    summary: '验证通过。',
    checks_run: ['npm test'],
    requirement_coverage: ['Requirement 1: 已覆盖'],
    recommended_next_step: '结束当前任务',
    walkthrough: '先执行测试，再抽查核心路径。',
  }), 'utf8');

  const result = runNode(
    ['verification', 'demo-task', '--template', '--meta-file', metaPath],
    { cwd: projectRoot },
  );
  assert.equal(result.status, 0, result.stderr);

  const verificationPath = path.join(projectRoot, '.oh-imean', 'specs', 'demo-task', 'verification.md');
  const content = fs.readFileSync(verificationPath, 'utf8');

  assert.match(content, /验证通过/);
  assert.match(content, /结束当前任务/);
});

test('artifact writer writes review template from metadata file', () => {
  const projectRoot = createTempProject();
  const metaPath = path.join(projectRoot, 'review-meta.json');

  fs.writeFileSync(metaPath, JSON.stringify({
    findings: ['[High] 登录失败分支未覆盖锁定状态'],
    requirement_alignment: ['Requirement 1: 部分满足'],
    regression_risks: ['可能影响已有登录错误提示'],
    testing_gaps: ['缺少登录锁定状态的集成测试'],
    recommendation: '返回 implement 补齐锁定状态测试',
  }), 'utf8');

  const result = runNode(
    ['review', 'demo-task', '--template', '--meta-file', metaPath],
    { cwd: projectRoot },
  );
  assert.equal(result.status, 0, result.stderr);

  const reviewPath = path.join(projectRoot, '.oh-imean', 'specs', 'demo-task', 'review.md');
  const content = fs.readFileSync(reviewPath, 'utf8');

  assert.match(content, /# Review Report/);
  assert.match(content, /## Findings/);
  assert.match(content, /\[High\] 登录失败分支未覆盖锁定状态/);
  assert.match(content, /## Recommendation/);
});

test('artifact writer supports JSON merge patch from file', () => {
  const projectRoot = createTempProject();
  const patchPath = path.join(projectRoot, 'state-patch.json');

  fs.writeFileSync(patchPath, JSON.stringify({
    mode: 'standardized',
    phase: 'implement',
    status: 'active',
    current_role: 'implementer',
    next_role: 'verifier',
  }), 'utf8');

  const result = runNode(
    ['state', 'demo-task', '--merge-file', patchPath],
    { cwd: projectRoot },
  );
  assert.equal(result.status, 0, result.stderr);

  const statePath = path.join(projectRoot, '.oh-imean', 'specs', 'demo-task', 'state.json');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));

  assert.equal(state.phase, 'implement');
  assert.equal(state.current_role, 'implementer');
  assert.equal(state.next_role, 'verifier');
});
