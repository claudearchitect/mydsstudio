/**
 * Registers `tsLoader.mjs` as an ESM resolve/load hook, then hands off to
 * `harness.ts`. Split from `tsLoader.mjs` itself because `module.register`
 * must be called from a separate entry module, not the hook module.
 *
 * Invoked via the `cli` npm script:
 *   node --experimental-strip-types --no-warnings \
 *     --import ./src/server/cli/register.mjs src/server/cli/harness.ts
 */
import { register } from "node:module";

register("./tsLoader.mjs", import.meta.url);
