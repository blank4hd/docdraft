"use client";
import { useEditorState, type Editor } from "@tiptap/react";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? "⌘" : "Ctrl";

function Btn(props: {
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const title = props.shortcut ? `${props.label} (${props.shortcut})` : props.label;
  return (
    <button
      type="button"
      className="tb-btn"
      title={title}
      aria-label={props.label}
      aria-pressed={props.active ?? undefined}
      disabled={props.disabled}
      // keep focus (and the selection) in the editor
      onMouseDown={(e) => e.preventDefault()}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

const ListIcon = ({ ordered }: { ordered?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
    {ordered ? (
      <text x="0" y="6" fontSize="5.5" fill="currentColor" stroke="none">1.</text>
    ) : (
      <circle cx="2" cy="4" r="1.2" fill="currentColor" stroke="none" />
    )}
    {ordered ? (
      <text x="0" y="13" fontSize="5.5" fill="currentColor" stroke="none">2.</text>
    ) : (
      <circle cx="2" cy="11" r="1.2" fill="currentColor" stroke="none" />
    )}
    <path d="M6 4h9M6 11h9" />
  </svg>
);

export function Toolbar({ editor, onInsertFile }: { editor: Editor; onInsertFile: () => void }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      block: e.isActive("heading", { level: 1 })
        ? "h1"
        : e.isActive("heading", { level: 2 })
          ? "h2"
          : e.isActive("heading", { level: 3 })
            ? "h3"
            : "p",
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const chain = () => editor.chain().focus();

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      <Btn label="Undo" shortcut={`${mod}+Z`} disabled={!s.canUndo} onClick={() => chain().undo().run()}>↶</Btn>
      <Btn label="Redo" shortcut={`${mod}+Shift+Z`} disabled={!s.canRedo} onClick={() => chain().redo().run()}>↷</Btn>
      <span className="tb-sep" />
      <select
        className="tb-select"
        aria-label="Text style"
        value={s.block}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "p") chain().setParagraph().run();
          else chain().setHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run();
        }}
      >
        <option value="p">Normal text</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
      <span className="tb-sep" />
      <Btn label="Bold" shortcut={`${mod}+B`} active={s.bold} onClick={() => chain().toggleBold().run()}>
        <b>B</b>
      </Btn>
      <Btn label="Italic" shortcut={`${mod}+I`} active={s.italic} onClick={() => chain().toggleItalic().run()}>
        <i style={{ fontFamily: "Georgia, serif" }}>I</i>
      </Btn>
      <Btn label="Underline" shortcut={`${mod}+U`} active={s.underline} onClick={() => chain().toggleUnderline().run()}>
        <u>U</u>
      </Btn>
      <Btn label="Strikethrough" shortcut={`${mod}+Shift+S`} active={s.strike} onClick={() => chain().toggleStrike().run()}>
        <s>S</s>
      </Btn>
      <span className="tb-sep" />
      <Btn label="Bulleted list" shortcut={`${mod}+Shift+8`} active={s.bullet} onClick={() => chain().toggleBulletList().run()}>
        <ListIcon />
      </Btn>
      <Btn label="Numbered list" shortcut={`${mod}+Shift+7`} active={s.ordered} onClick={() => chain().toggleOrderedList().run()}>
        <ListIcon ordered />
      </Btn>
      <Btn label="Quote" active={s.quote} onClick={() => chain().toggleBlockquote().run()}>
        ❝
      </Btn>
      <span className="tb-sep" />
      <button type="button" className="tb-btn" onClick={onInsertFile} title="Insert content from a .txt, .md or .docx file">
        ⤒ Insert from file
      </button>
    </div>
  );
}
