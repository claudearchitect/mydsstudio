/**
 * A minimal ESM resolver hook so `node --experimental-strip-types` can run
 * the CLI harness directly against the project's TypeScript sources with
 * NO build step and NO new npm dependency (ground rule: "Do NOT add npm
 * dependencies").
 *
 * Node's built-in type-stripping (stable enough for our purposes, still
 * flagged experimental by Node itself) strips TS syntax but does not
 * resolve extensionless specifiers (`./foo`) or path aliases (`@/foo`) the
 * way `tsconfig.json`'s `paths` + bundler resolution do. This hook covers
 * exactly those two gaps:
 *
 *   1. `@/x` -> `<repoRoot>/src/x` (mirrors tsconfig.json's `@/*` path)
 *   2. an extensionless relative/alias-resolved specifier is retried with
 *      `.ts`, `.tsx`, then `/index.ts` appended, in that order.
 *
 * Nothing here is Next.js- or Vitest-specific; it only concerns itself with
 * making `node --experimental-strip-types --import ./tsLoader.mjs
 * cli.ts` work standalone, which is what `npm run cli` wires up.
 */
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "../../../../");
const SRC_ROOT = path.join(REPO_ROOT, "src");

const CANDIDATE_EXTENSIONS = [".ts", ".tsx", ".mts"];

/**
 * The CLI harness never renders UI — it only needs BeliefState, patches,
 * and schemas from `@/contracts`, all of which are plain `.ts`. The one
 * `.tsx` file in that barrel, `renderComponent.tsx`, is a React component
 * Node's `--experimental-strip-types` cannot load (JSX is not
 * strippable TypeScript-only syntax; it changes program behavior).
 * Rather than fork the frozen contracts barrel for the CLI, this hook
 * substitutes an inert stub for that one file, ONLY when resolved through
 * this loader (i.e. only in the CLI's process) — every other consumer
 * (Next.js, Vitest) uses a real bundler and never goes through this file.
 */
const STUBBED_MODULES = new Set([path.join(SRC_ROOT, "contracts", "renderComponent.tsx")]);
const STUB_SOURCE =
  "export function renderComponent() { throw new Error('renderComponent is not available in the CLI harness (no DOM/React renderer) — this stub exists only so node --experimental-strip-types can load src/contracts/index.ts without a JSX transform.'); }\n";

export async function resolve(specifier, context, nextResolve) {
  // 1. Alias: @/foo -> <repo>/src/foo
  if (specifier.startsWith("@/")) {
    const aliased = path.join(SRC_ROOT, specifier.slice("@/".length));
    return resolveWithExtensions(aliased, nextResolve, context);
  }

  // 2. Relative specifiers Node's default resolver can't already handle
  // (i.e. it threw, or it's extensionless) get the same extension probe.
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const hasKnownExt = CANDIDATE_EXTENSIONS.some((ext) => specifier.endsWith(ext));
    if (!hasKnownExt) {
      const parentPath = context.parentURL ? fileURLToPath(context.parentURL) : REPO_ROOT;
      const basePath = path.resolve(path.dirname(parentPath), specifier);
      return resolveWithExtensions(basePath, nextResolve, context);
    }
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  const filePath = url.startsWith("file://") ? fileURLToPath(url) : null;
  if (filePath && STUBBED_MODULES.has(filePath)) {
    return { format: "module", shortCircuit: true, source: STUB_SOURCE };
  }
  return nextLoad(url, context);
}

async function resolveWithExtensions(basePathNoExt, nextResolve, context) {
  for (const ext of CANDIDATE_EXTENSIONS) {
    const candidate = basePathNoExt + ext;
    if (existsSync(candidate)) {
      return nextResolve(pathToFileURL(candidate).href, context);
    }
  }
  for (const ext of CANDIDATE_EXTENSIONS) {
    const candidate = path.join(basePathNoExt, "index" + ext);
    if (existsSync(candidate)) {
      return nextResolve(pathToFileURL(candidate).href, context);
    }
  }
  // Fall through to default resolution (e.g. it's actually a directory
  // with a package.json, or specifier already had a valid extension) so
  // errors still surface with Node's normal diagnostics.
  return nextResolve(pathToFileURL(basePathNoExt).href, context);
}
