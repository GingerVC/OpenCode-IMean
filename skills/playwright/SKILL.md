---
name: playwright
description: MUST USE for browser tasks. Browser automation via Playwright MCP for verification, screenshots, browsing, scraping, and UI testing.
mcp:
  playwright:
    command: npx
    args:
      - "@playwright/mcp@latest"
---
# Playwright Browser Automation

Use this skill for:

- opening and navigating sites
- checking UI behavior
- filling forms
- taking screenshots
- collecting browser evidence
- validating flows end to end

## Core Workflow

1. Open the target page.
2. Inspect the page state or accessibility snapshot.
3. Interact in small steps.
4. Re-check after each major action.
5. Capture screenshot or logs when verifying behavior.

## Good Usage Pattern

- navigate
- inspect
- click or fill
- wait for result
- verify text, element state, URL, or screenshot

## Rules

- Prefer small, verifiable steps over long blind sequences.
- Re-check page state after navigation or DOM-changing actions.
- Use screenshots when the result is visual.
- Use browser evidence for bug reports or verification summaries.

## Typical Tasks

- login flow verification
- modal and form testing
- regression checks after frontend changes
- screenshot generation
- content extraction from web pages

## Completion

Before wrapping up, report:

- what page or flow was tested
- what actions were performed
- what evidence confirmed success or failure
