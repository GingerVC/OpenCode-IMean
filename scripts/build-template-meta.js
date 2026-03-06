#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function parseArgs(argv) {
  const [preset, taskSlug, ...rest] = argv;
  const options = {
    preset: String(preset || '').trim(),
    taskSlug: String(taskSlug || '').trim(),
    out: '',
    values: {},
    lists: {},
  };

  const listFlags = new Set([
    'assumption',
    'open-question',
    'check-run',
    'check-skip',
    'finding',
    'alignment',
    'regression-risk',
    'testing-gap',
    'coverage',
    'risk',
    'scope',
    'non-goal',
    'constraint',
    'linked-artifact',
    'change',
    'step',
    'verify',
    'automated-check',
    'manual-check',
    'replan-trigger',
    'acceptance',
  ]);

  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    if (!flag.startsWith('--')) continue;
    const key = flag.slice(2);
    const value = rest[index + 1] || '';
    index += 1;

    if (key === 'out') {
      options.out = value;
      continue;
    }

    if (listFlags.has(key)) {
      options.lists[key] = options.lists[key] || [];
      if (value) options.lists[key].push(value);
      continue;
    }

    options.values[key] = value;
  }

  return options;
}

function readJsonFile(filePath) {
  if (!filePath) return null;
  const resolvedPath = path.resolve(filePath);
  return JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
}

function buildDispatchHandoff(options) {
  return {
    phase: options.values.phase || 'intake',
    from_role: options.values['from-role'] || 'dispatcher',
    to_role: options.values['to-role'] || 'spec-planner',
    context: options.values.context || '',
    assumptions: options.lists.assumption || [],
    open_questions: options.lists['open-question'] || [],
    next_action: options.values['next-action'] || `运行 /plan ${options.taskSlug}`,
  };
}

function buildPlanRequirements(options) {
  const externalRequirements = readJsonFile(options.values['requirements-file']);
  const inlineRequirements = options.values['requirement-title']
    ? [{
        title: options.values['requirement-title'],
        user_story: options.values['user-story'] || 'TBD',
        acceptance_criteria: options.lists.acceptance || [],
      }]
    : [];

  return {
    introduction: options.values.introduction || '',
    scope: options.lists.scope || [],
    non_goals: options.lists['non-goal'] || [],
    constraints: options.lists.constraint || [],
    assumptions: options.lists.assumption || [],
    requirements: externalRequirements || inlineRequirements,
  };
}

function buildPlanImplementation(options) {
  return {
    goal: options.values.goal || '',
    selected_option: options.values['selected-option'] || '',
    execution_boundary: options.values['execution-boundary'] || '',
    linked_artifacts: options.lists['linked-artifact'] || [],
    proposed_changes: options.lists.change || [],
    execution_steps: options.lists.step || [],
    verification_plan: options.lists.verify || [],
    automated_checks: options.lists['automated-check'] || [],
    manual_smoke_checks: options.lists['manual-check'] || [],
    replan_triggers: options.lists['replan-trigger'] || [],
  };
}

function buildPlanHandoff(options) {
  return {
    phase: options.values.phase || 'implement',
    from_role: options.values['from-role'] || 'spec-planner',
    to_role: options.values['to-role'] || 'implementer',
    context: options.values.context || '',
    assumptions: options.lists.assumption || [],
    open_questions: options.lists['open-question'] || [],
    next_action: options.values['next-action'] || `运行 /kickoff ${options.taskSlug}`,
  };
}

function buildKickoffHandoff(options) {
  return {
    phase: options.values.phase || 'verify',
    from_role: options.values['from-role'] || 'implementer',
    to_role: options.values['to-role'] || 'verifier',
    context: options.values.context || '',
    assumptions: options.lists.assumption || [],
    open_questions: options.lists['open-question'] || [],
    next_action: options.values['next-action'] || `运行 /verify ${options.taskSlug}`,
  };
}

function buildVerifyReport(options) {
  return {
    status: options.values.status || 'pending',
    summary: options.values.summary || '',
    checks_run: options.lists['check-run'] || [],
    checks_not_run: options.lists['check-skip'] || [],
    requirement_coverage: options.lists.coverage || [],
    risks: options.lists.risk || [],
    recommended_next_step: options.values['next-step'] || '',
    walkthrough: options.values.walkthrough || '',
  };
}

function buildReviewReport(options) {
  return {
    findings: options.lists.finding || [],
    requirement_alignment: options.lists.alignment || [],
    regression_risks: options.lists['regression-risk'] || [],
    testing_gaps: options.lists['testing-gap'] || [],
    recommendation: options.values.recommendation || '',
  };
}

function buildStatePatch(options) {
  return {
    mode: options.values.mode || undefined,
    phase: options.values.phase || undefined,
    status: options.values.status || undefined,
    current_goal: options.values.goal || undefined,
    current_role: options.values['current-role'] || undefined,
    next_role: options.values['next-role'] || undefined,
    selected_option: options.values['selected-option'] || undefined,
    active_step: options.values['active-step'] || undefined,
    uncertainty_level: options.values.uncertainty || undefined,
    replan_reason: options.values['replan-reason'] || undefined,
    review_status: options.values['review-status'] || undefined,
    verification_status: options.values['verification-status'] || undefined,
    last_verified_at: options.values['last-verified-at'] || undefined,
    discarded_context_summary: options.values['discarded-context-summary'] || undefined,
    last_blocking_reason: options.values['last-blocking-reason'] || undefined,
    recommended_next_command: options.values['recommended-next-command'] || undefined,
  };
}

function buildRuntimePatch(options) {
  return {
    phase: options.values.phase || undefined,
    hook_profile: options.values['hook-profile'] || undefined,
    recommended_next_command: options.values['recommended-next-command'] || undefined,
    last_blocking_reason: options.values['last-blocking-reason'] || undefined,
    review_status: options.values['review-status'] || undefined,
    verification_status: options.values['verification-status'] || undefined,
    last_verified_at: options.values['last-verified-at'] || undefined,
    last_review_summary: options.values['last-review-summary'] || undefined,
    last_verification_summary: options.values['last-verification-summary'] || undefined,
    selected_option: options.values['selected-option'] || undefined,
    active_step: options.values['active-step'] || undefined,
    mode: options.values.mode || undefined,
  };
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  );
}

function buildMeta(options) {
  switch (options.preset) {
    case 'dispatch-handoff':
      return buildDispatchHandoff(options);
    case 'plan-requirements':
      return buildPlanRequirements(options);
    case 'plan-implementation':
      return buildPlanImplementation(options);
    case 'plan-handoff':
      return buildPlanHandoff(options);
    case 'kickoff-handoff':
      return buildKickoffHandoff(options);
    case 'verify-report':
      return buildVerifyReport(options);
    case 'review-report':
      return buildReviewReport(options);
    case 'dispatch-state':
    case 'plan-state':
    case 'kickoff-state':
    case 'review-state':
    case 'verify-state':
      return compactObject(buildStatePatch(options));
    case 'dispatch-runtime':
    case 'plan-runtime':
    case 'kickoff-runtime':
    case 'review-runtime':
    case 'verify-runtime':
      return compactObject(buildRuntimePatch(options));
    default:
      throw new Error(`unsupported preset: ${options.preset}`);
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.preset) {
    throw new Error('preset is required');
  }

  const content = buildMeta(options);
  const payload = `${JSON.stringify(content, null, 2)}\n`;

  if (!options.out) {
    process.stdout.write(payload);
    return;
  }

  const outPath = path.resolve(options.out);
  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, payload, 'utf8');
  process.stdout.write(`${outPath}\n`);
}

main();
