import { HttpError, json, requireUser, route } from "@/lib/http";
import { MAX_UPLOAD_BYTES, fileToDoc } from "@/lib/convert";
import { createDocument } from "@/lib/documents";

/**
 * POST multipart/form-data { file, mode }
 *   mode=new      → creates a new document from the file (default)
 *   mode=convert  → returns editor content only; the editor inserts it into the
 *                   open document and the normal autosave persists it, so the
 *                   usual edit-permission and version checks still apply.
 */
export const POST = route(async (req) => {
  const user = await requireUser(req);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, "Expected a multipart form upload.");
  }
  const file = form.get("file");
  const mode = form.get("mode") ?? "new";
  if (!(file instanceof File) || file.size === 0) throw new HttpError(400, "Choose a non-empty file to upload.");
  if (file.size > MAX_UPLOAD_BYTES) throw new HttpError(413, "File is too large (max 2 MB).");
  if (mode !== "new" && mode !== "convert") throw new HttpError(400, "Invalid import mode.");

  const { title, content } = await fileToDoc(file.name, Buffer.from(await file.arrayBuffer()));

  if (mode === "convert") return json({ title, content });
  const doc = await createDocument(user.id, title, content);
  return json({ document: { id: doc.id, title: doc.title } }, 201);
});
