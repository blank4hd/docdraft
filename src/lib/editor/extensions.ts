// Shared by the browser editor AND the server (validation + file import), so a
// document can only ever contain nodes/marks the editor knows how to render.
import StarterKit from "@tiptap/starter-kit";

export const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    // Links need URL validation + UI; deliberately out of scope. Imported links keep their text.
    link: false,
  }),
];
