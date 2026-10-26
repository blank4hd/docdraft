import { getSchema, type JSONContent } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import { editorExtensions } from "./editor/extensions";

export const MAX_CONTENT_BYTES = 1_000_000; // ~1 MB of JSON per document

const schema = getSchema(editorExtensions);

export const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

export class InvalidContentError extends Error {}

/**
 * Validates arbitrary JSON against the editor's ProseMirror schema.
 * Rejects unknown node/mark types and illegal nesting, so the DB never holds
 * content the editor can't render (and never holds raw HTML → no stored XSS).
 */
export function validateContent(input: unknown): JSONContent {
  const size = JSON.stringify(input ?? null).length;
  if (size > MAX_CONTENT_BYTES) {
    throw new InvalidContentError("Document is too large (max ~1 MB).");
  }
  if (!input || typeof input !== "object" || (input as JSONContent).type !== "doc") {
    throw new InvalidContentError("Content must be a document.");
  }
  try {
    const node = PMNode.fromJSON(schema, input as Record<string, unknown>);
    node.check();
    return node.toJSON() as JSONContent;
  } catch (err) {
    throw new InvalidContentError(
      `Content does not match the editor schema: ${(err as Error).message}`,
    );
  }
}

/** Plain-text preview used on the dashboard. */
export function previewText(doc: JSONContent, max = 140): string {
  const parts: string[] = [];
  const walk = (n: JSONContent) => {
    if (n.text) parts.push(n.text);
    n.content?.forEach((c) => {
      walk(c);
      if (c.type !== "text") parts.push(" ");
    });
  };
  walk(doc);
  const text = parts.join("").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}
