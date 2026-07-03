/**
 * Workstream D barrel — design.md export. Pure serialization
 * (`serializeDesignMd`) plus a self-contained UI (`ExportPanel`), mountable
 * anywhere without depending on `src/shell/` internals.
 */
export * from "./types";
export * from "./frontMatter";
export * from "./sections";
export * from "./serializeDesignMd";
export * from "./deriveTranscript";
export * from "./ExportPanel";
