// Turns an uploaded file into editor content. Server-only.
import { generateJSON } from "@tiptap/html/server";
import type { JSONContent } from "@tiptap/core";
import mammoth from "mammoth";
import { marked } from "marked";
import { editorExtensions } from "./editor/extensions";
import { EMPTY_DOC, validateContent } from "./content";

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB
export const SUPPORTED_EXTENSIONS = [".txt", ".md", ".docx"] as const;
export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

export class UnsupportedFileError extends Error {}

export function extensionOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i === -1 ? "" : filename.slice(i).toLowerCase();
}

export function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return (base || "Imported document").slice(0, 200);
}

function decodeText(buf: Buffer): string {
  // A NUL byte almost always means a binary file renamed to .txt/.md.
  if (buf.includes(0)) throw new UnsupportedFileError("File does not look like plain text.");
  return buf.toString("utf8").replace(/^﻿/, "").replace(/\r\n?/g, "\n");
}

export function textToDoc(text: string): JSONContent {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.replace(/^\n+|\n+$/g, ""))
    .filter((b) => b.trim().length > 0);
  if (blocks.length === 0) return EMPTY_DOC;
  return {
    type: "doc",
    content: blocks.map((block) => {
      const lines = block.split("\n");
      const content: JSONContent[] = [];
      lines.forEach((line, i) => {
        if (i > 0) content.push({ type: "hardBreak" });
        if (line.length) content.push({ type: "text", text: line });
      });
      return { type: "paragraph", content };
    }),
  };
}

function htmlToDoc(html: string): JSONContent {
  // Parsing through the editor schema drops anything it doesn't support
  // (scripts, images, tables, styles), which doubles as sanitisation.
  const json = generateJSON(html, editorExtensions) as JSONContent;
  return json.content && json.content.length ? json : EMPTY_DOC;
}

export async function fileToDoc(
  filename: string,
  buf: Buffer,
): Promise<{ title: string; content: JSONContent }> {
  const ext = extensionOf(filename);
  if (!(SUPPORTED_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new UnsupportedFileError(
      `Unsupported file type "${ext || "none"}". Supported: ${SUPPORTED_EXTENSIONS.join(", ")}.`,
    );
  }
  if (buf.byteLength > MAX_UPLOAD_BYTES) {
    throw new UnsupportedFileError("File is too large (max 2 MB).");
  }

  let content: JSONContent;
  if (ext === ".txt") {
    content = textToDoc(decodeText(buf));
  } else if (ext === ".md") {
    content = htmlToDoc(await marked.parse(decodeText(buf), { gfm: true }));
  } else {
    // .docx is a zip archive: check the magic bytes before handing to mammoth.
    if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
      throw new UnsupportedFileError("File is not a valid .docx document.");
    }
    try {
      const { value } = await mammoth.convertToHtml(
        { buffer: buf },
        { styleMap: ["u => u"] }, // mammoth drops underline by default
      );
      content = htmlToDoc(value);
    } catch {
      throw new UnsupportedFileError("Could not read this .docx file.");
    }
  }

  return { title: titleFromFilename(filename), content: validateContent(content) };
}
