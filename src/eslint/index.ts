import type { ESLint, Linter } from 'eslint';
import { restrictActorUsage } from './restrictActorUsage';

/**
 * ESLint plugin for specs that use @bloom-group/serenity-process.
 *
 * @example
 *  // eslint.config.mjs
 *  import serenityProcess from '@bloom-group/serenity-process/eslint';
 *
 *  export default [
 *      { files: [ '**\/*.spec.ts' ], ...serenityProcess.configs.recommended },
 *  ];
 */
const plugin = {
    meta: { name: '@bloom-group/serenity-process' },
    rules: {
        'restrict-actor-usage': restrictActorUsage,
    },
    configs: {} as Record<string, Linter.Config>,
} satisfies ESLint.Plugin;

plugin.configs.recommended = {
    plugins: { 'serenity-process': plugin },
    rules: { 'serenity-process/restrict-actor-usage': 'error' },
};

export = plugin;
