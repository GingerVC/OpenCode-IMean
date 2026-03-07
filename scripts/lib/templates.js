'use strict';

function toArray(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).map(item => String(item).trim()).filter(Boolean);
  }

  if (value === null || value === undefined) return [];

  const text = String(value).trim();
  return text ? [text] : [];
}

function toBulletList(items, fallback = '- TBD') {
  const values = toArray(items);
  if (values.length === 0) return fallback;
  return values.map(item => `- ${item}`).join('\n');
}

function toNumberedList(items, fallback = '1. TBD') {
  const values = toArray(items);
  if (values.length === 0) return fallback;
  return values.map(item => `1. ${item}`).join('\n');
}

function toParagraph(value, fallback = 'TBD') {
  const text = String(value || '').trim();
  return text || fallback;
}

function buildRequirementsTemplate(taskSlug, meta = {}) {
  const requirements = Array.isArray(meta.requirements) ? meta.requirements : [];
  const requirementSections = requirements.length > 0
    ? requirements.map((item, index) => {
        const title = String(item?.title || `待补充需求 ${index + 1}`).trim();
        const userStory = toParagraph(item?.user_story, 'TBD');
        const acceptanceCriteria = toArray(item?.acceptance_criteria);

        return [
          `### Requirement ${index + 1} - ${title}`,
          `**User Story:** ${userStory}`,
          '',
          '#### Acceptance Criteria',
          acceptanceCriteria.length > 0
            ? acceptanceCriteria.map(line => `- ${line}`).join('\n')
            : '- WHEN [condition] THEN the system SHALL [behavior]',
        ].join('\n');
      }).join('\n\n')
    : [
        '### Requirement 1 - 待补充',
        '**User Story:** TBD',
        '',
        '#### Acceptance Criteria',
        '- WHEN [condition] THEN the system SHALL [behavior]',
      ].join('\n');

  return [
    '# Requirements Document',
    '',
    `- task-slug: ${taskSlug}`,
    '',
    '## Introduction',
    toParagraph(meta.introduction, '补充任务背景、目标和业务价值。'),
    '',
    '## Scope',
    toBulletList(meta.scope, '- 待补充范围'),
    '',
    '## Non-Goals',
    toBulletList(meta.non_goals, '- 待补充非目标'),
    '',
    '## Constraints',
    toBulletList(meta.constraints, '- 待补充约束'),
    '',
    '## Assumptions',
    toBulletList(meta.assumptions, '- 待补充假设'),
    '',
    '## Requirements',
    requirementSections,
    '',
  ].join('\n');
}

function buildPlanTemplate(taskSlug, meta = {}) {
  const linkedArtifacts = toArray(meta.linked_artifacts);
  if (linkedArtifacts.length === 0) {
    linkedArtifacts.push(
      `.oh-imean/specs/${taskSlug}/requirements.md`,
      `.oh-imean/specs/${taskSlug}/handoff.md`
    );
  }

  return [
    '# Implementation Plan',
    '',
    `- task-slug: ${taskSlug}`,
    '',
    '## Goal',
    toParagraph(meta.goal, '补充本次实现的目标。'),
    '',
    '## Selected Option',
    toParagraph(meta.selected_option, 'TBD'),
    '',
    '## Execution Boundary',
    toParagraph(meta.execution_boundary, '只覆盖当前选定方案授权范围，不扩展到额外重构。'),
    '',
    '## Linked Artifacts',
    toBulletList(linkedArtifacts),
    '',
    '## Proposed Changes',
    toBulletList(meta.proposed_changes, '- [MODIFY] 待补充文件与意图'),
    '',
    '## Execution Steps',
    toNumberedList(meta.execution_steps),
    '',
    '## Verification Plan',
    '### Automated Checks',
    toBulletList(meta.automated_checks, '- 待补充自动化检查'),
    '',
    '### Manual / Smoke Checks',
    toBulletList(meta.manual_smoke_checks, '- 待补充手动验证'),
    ...(toArray(meta.verification_plan).length > 0
      ? ['', '### Additional Verification Notes', toBulletList(meta.verification_plan)]
      : []),
    '',
    '## Replan Triggers',
    toBulletList(meta.replan_triggers, '- 发现需求边界与当前代码事实冲突'),
    '',
  ].join('\n');
}

function buildVerificationTemplate(taskSlug, meta = {}) {
  return [
    '# Verification Report',
    '',
    `- task-slug: ${taskSlug}`,
    '',
    '## Status',
    toParagraph(meta.status, 'pending'),
    '',
    '## Summary',
    toParagraph(meta.summary, '待补充验证摘要。'),
    '',
    '## Checks Run',
    toBulletList(meta.checks_run, '- 待补充已执行检查'),
    '',
    '## Checks Not Run',
    toBulletList(meta.checks_not_run, '- 无'),
    '',
    '## Requirement Coverage',
    toBulletList(meta.requirement_coverage, '- 待补充需求覆盖情况'),
    '',
    '## Risks / Remaining Issues',
    toBulletList(meta.risks, '- 无'),
    '',
    '## Recommended Next Step',
    toParagraph(meta.recommended_next_step, '根据验证结果决定是否返回 dispatch 或结束任务。'),
    '',
    '## Walkthrough',
    toParagraph(meta.walkthrough, '记录验证顺序、关键观察和可复现步骤。'),
    '',
  ].join('\n');
}

function buildReviewTemplate(taskSlug, meta = {}) {
  return [
    '# Review Report',
    '',
    `- task-slug: ${taskSlug}`,
    '',
    '## Findings',
    toBulletList(meta.findings, '- 无发现'),
    '',
    '## Requirement / Intent Alignment',
    toBulletList(meta.requirement_alignment, '- 待补充需求一致性判断'),
    '',
    '## Regression Risks',
    toBulletList(meta.regression_risks, '- 无'),
    '',
    '## Testing Gaps',
    toBulletList(meta.testing_gaps, '- 无'),
    '',
    '## Recommendation',
    toParagraph(meta.recommendation, '进入 verify 阶段'),
    '',
  ].join('\n');
}

function buildHandoffTemplate(taskSlug, meta = {}) {
  return [
    '# Phase Handoff',
    '',
    `- task-slug: ${taskSlug}`,
    `- phase: ${String(meta.phase || '').trim()}`,
    `- from-role: ${String(meta.from_role || '').trim()}`,
    `- to-role: ${String(meta.to_role || '').trim()}`,
    '',
    '## Context',
    toParagraph(meta.context, ''),
    '',
    '## Assumptions',
    toBulletList(meta.assumptions, ''),
    '',
    '## Open Questions',
    toBulletList(meta.open_questions, ''),
    '',
    '## Next Action',
    toParagraph(meta.next_action, ''),
    '',
  ].join('\n');
}

function buildSessionSummaryTemplate(sessionId, meta = {}) {
  return [
    `# Session Summary (${sessionId})`,
    '',
    '## Context',
    `- generated_at: ${toParagraph(meta.generated_at, 'unknown')}`,
    `- mode: ${toParagraph(meta.mode, 'unknown')}`,
    `- task-slug: ${toParagraph(meta.task_slug, 'none')}`,
    `- phase: ${toParagraph(meta.phase, 'none')}`,
    `- execution_lane: ${toParagraph(meta.execution_lane, 'unknown')}`,
    `- planning_depth: ${toParagraph(meta.planning_depth, 'unknown')}`,
    `- hook_profile: ${toParagraph(meta.hook_profile, 'unknown')}`,
    '',
    '## Current Goal',
    toParagraph(meta.current_goal, '未检测到明确目标'),
    '',
    '## Signals',
    toBulletList(meta.signals, '- 暂无可提取的用户目标'),
    '',
    '## Failed Attempts / Blockers',
    toBulletList(meta.failures, '- 未检测到明确失败信号'),
    '',
    '## Touched Files',
    toBulletList(meta.touched_files, '- 无'),
    '',
    '## Tools Used',
    toBulletList(meta.tools_used, '- 无'),
    '',
    '## Next Step',
    `- recommended_next_command: ${toParagraph(meta.recommended_next_command, '/dispatch <需求>')}`,
    ...(toParagraph(meta.active_step, '') ? [`- active_step: ${String(meta.active_step).trim()}`] : []),
    '',
  ].join('\n');
}

function buildSessionStartTemplate(meta = {}) {
  const latestSummary = String(meta.latest_session_summary || '').trim();
  const lines = [
    'oh-imean resume context:',
    '',
    '## Context',
    `- mode: ${toParagraph(meta.mode, 'unknown')}`,
    `- task-slug: ${toParagraph(meta.task_slug, 'none')}`,
    `- phase: ${toParagraph(meta.phase, 'unknown')}`,
    `- execution_lane: ${toParagraph(meta.execution_lane, 'unknown')}`,
    `- planning_depth: ${toParagraph(meta.planning_depth, 'unknown')}`,
    `- verification_status: ${toParagraph(meta.verification_status, 'unknown')}`,
    `- selected_option: ${toParagraph(meta.selected_option, 'none')}`,
    `- active_step: ${toParagraph(meta.active_step, 'none')}`,
    `- recommended_next_command: ${toParagraph(meta.recommended_next_command, '/dispatch <需求>')}`,
    `- handoff: ${toParagraph(meta.handoff, 'none')}`,
  ];

  if (latestSummary) {
    lines.push('', '## Latest Session Summary', latestSummary);
  }

  if (String(meta.latest_review_summary || '').trim()) {
    lines.push('', '## Latest Review Summary', String(meta.latest_review_summary).trim());
  }

  if (String(meta.latest_verification_summary || '').trim()) {
    lines.push('', '## Latest Verification Summary', String(meta.latest_verification_summary).trim());
  }

  lines.push('');
  return lines.join('\n');
}

function buildCompactSnapshot(meta = {}) {
  return {
    generated_at: toParagraph(meta.generated_at, new Date().toISOString()),
    hook_profile: toParagraph(meta.hook_profile, 'standard'),
    mode: meta.mode || null,
    execution_lane: meta.execution_lane || null,
    planning_depth: meta.planning_depth || null,
    task_slug: meta.task_slug || null,
    phase: meta.phase || null,
    verification_status: meta.verification_status || null,
    recommended_next_command: toParagraph(meta.recommended_next_command, '/dispatch <需求>'),
    selected_option: meta.selected_option || null,
    active_step: meta.active_step || null,
    last_blocking_reason: meta.last_blocking_reason || null,
  };
}

function buildArtifactTemplate(artifactKind, taskSlug, meta = {}) {
  switch (artifactKind) {
    case 'requirements':
      return buildRequirementsTemplate(taskSlug, meta);
    case 'plan':
      return buildPlanTemplate(taskSlug, meta);
    case 'verification':
      return buildVerificationTemplate(taskSlug, meta);
    case 'review':
      return buildReviewTemplate(taskSlug, meta);
    case 'handoff':
      return buildHandoffTemplate(taskSlug, meta);
    default:
      throw new Error(`template is not supported for artifact kind: ${artifactKind}`);
  }
}

module.exports = {
  buildArtifactTemplate,
  buildHandoffTemplate,
  buildPlanTemplate,
  buildCompactSnapshot,
  buildRequirementsTemplate,
  buildReviewTemplate,
  buildSessionStartTemplate,
  buildSessionSummaryTemplate,
  buildVerificationTemplate,
};
