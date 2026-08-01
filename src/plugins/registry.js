/**
 * src/plugins/registry.js — Plugin registry
 *
 * Central registry for all plugin slots. Plugins are registered once at
 * startup and retrieved by slot name throughout the application.
 *
 * Built-in slots: 'storage' | 'llm' | 'validator'
 * Custom slots are accepted for third-party extensions.
 *
 * Pure logic — no runtime-specific APIs.
 */

import { assertStoragePlugin, assertLLMPlugin, assertValidatorPlugin } from './interfaces.js';

// ─── Slot → guard mapping ─────────────────────────────────────────────────────

/** @type {Record<string, (plugin: unknown) => void>} */
const GUARDS = {
  storage:   assertStoragePlugin,
  llm:       assertLLMPlugin,
  validator: assertValidatorPlugin,
};

/** @type {Map<string, object>} */
const registry = new Map();

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Register a plugin in a named slot.
 *
 * For the built-in slots ('storage', 'llm', 'validator') the plugin is
 * validated against its interface contract before being stored.
 * Custom slot names bypass validation — callers are responsible for
 * defining their own contracts.
 *
 * @param {'storage'|'llm'|'validator'|string} slot
 * @param {object} plugin
 */
export function registerPlugin(slot, plugin) {
  const guard = GUARDS[slot];
  if (guard) guard(plugin);
  registry.set(slot, plugin);
}

/**
 * Retrieve the plugin registered for a named slot.
 * Throws if no plugin has been registered for that slot.
 *
 * @param {string} slot
 * @returns {object}
 */
export function getPlugin(slot) {
  const plugin = registry.get(slot);
  if (!plugin) {
    throw new Error(
      `No plugin registered for slot "${slot}". ` +
      'Call registerPlugin() during application startup.',
    );
  }
  return plugin;
}

/**
 * Return an array of all currently registered slot names.
 *
 * @returns {string[]}
 */
export function listPlugins() {
  return [...registry.keys()];
}
