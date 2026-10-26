import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileToDoc, textToDoc, UnsupportedFileError } from "@/lib/convert";
import { validateContent, InvalidContentError } from "@/lib/content";

const fixture = (name: string) => readFileSync(path.join(__dirname, "fixtures", name));
const types = (doc: { content?: { type?: string }[] }) => doc.content?.map((n) => n.type);

describe("file import", () => {
  it(".txt: blank lines split paragraphs, single newlines become line breaks", () => {
    const doc = textToDoc("a\nb\n\nc\n");
    expect(doc.content).toHaveLength(2);
    expect(doc.content![0].content!.map((n) => n.type)).toEqual(["text", "hardBreak", "text"]);
    expect(doc.content![1].content).toEqual([{ type: "text", text: "c" }]);
  });

  it(".md: keeps headings, marks and both list types; drops raw HTML", async () => {
    const { title, content } = await fileToDoc("roadmap.md", fixture("roadmap.md"));
    expect(title).toBe("roadmap");
    expect(types(content)).toEqual(["heading", "paragraph", "bulletList", "orderedList"]);
    expect(JSON.stringify(content)).toContain('"type":"bold"');
    expect(JSON.stringify(content)).not.toMatch(/script|alert/);
  });

  it(".docx: keeps heading, bold, underline and lists", async () => {
    const { content } = await fileToDoc("spec.docx", fixture("spec.docx"));
    const json = JSON.stringify(content);
    expect(types(content)).toEqual(["heading", "paragraph", "bulletList"]);
    expect(json).toContain('"type":"bold"');
    expect(json).toContain('"type":"underline"');
  });

  it("rejects unsupported, disguised and oversized files", async () => {
    await expect(fileToDoc("x.pdf", Buffer.from("hi"))).rejects.toBeInstanceOf(UnsupportedFileError);
    await expect(fileToDoc("fake.docx", fixture("fake.docx"))).rejects.toBeInstanceOf(UnsupportedFileError);
    await expect(fileToDoc("bin.txt", Buffer.from([104, 0, 105]))).rejects.toBeInstanceOf(UnsupportedFileError);
    await expect(fileToDoc("big.txt", Buffer.alloc(3 * 1024 * 1024, 97))).rejects.toBeInstanceOf(UnsupportedFileError);
  });
});

describe("validateContent", () => {
  it("accepts a valid document", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }] };
    expect(validateContent(doc)).toEqual(doc);
  });
  it("rejects unknown nodes, illegal nesting and non-documents", () => {
    expect(() => validateContent({ type: "doc", content: [{ type: "iframe" }] })).toThrow(InvalidContentError);
    expect(() => validateContent({ type: "doc", content: [{ type: "text", text: "loose" }] })).toThrow(InvalidContentError);
    expect(() => validateContent("<p>html</p>")).toThrow(InvalidContentError);
  });
});
