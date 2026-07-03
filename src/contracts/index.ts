/**
 * Contracts barrel — every shared type/schema/function importable from
 * "@/contracts". Frozen after Phase 0 (V0_PLAN.md "Contract-freeze rule");
 * changes land as dedicated commits, not workstream-local edits.
 */

export * from "./beliefState";
export * from "./tokenRef";
export * from "./tokenPatch";
export * from "./applyPatch";
export * from "./message";
export * from "./interaction";
export * from "./tools";
export * from "./toJsonSchema";
export * from "./componentManifest";
export * from "./renderComponent";
export * from "./resolveTokens";
export * from "./turnWireFormat";
