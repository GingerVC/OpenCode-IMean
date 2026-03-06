'use strict';

const DEFAULT_PROFILE = 'standard';
const VALID_PROFILES = new Set(['minimal', 'standard', 'strict']);

function getHookProfile() {
  const raw = String(process.env.OH_IMEAN_HOOK_PROFILE || DEFAULT_PROFILE).trim().toLowerCase();
  return VALID_PROFILES.has(raw) ? raw : DEFAULT_PROFILE;
}

function getDisabledHooks() {
  return new Set(
    String(process.env.OH_IMEAN_DISABLED_HOOKS || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)
  );
}

function isHookEnabled(hookId, options = {}) {
  if (!hookId) return true;

  const disabled = getDisabledHooks();
  if (disabled.has(hookId)) {
    return false;
  }

  const profiles = String(options.profiles || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);

  if (profiles.length === 0) {
    return true;
  }

  return profiles.includes(getHookProfile());
}

module.exports = {
  DEFAULT_PROFILE,
  getHookProfile,
  isHookEnabled,
};
