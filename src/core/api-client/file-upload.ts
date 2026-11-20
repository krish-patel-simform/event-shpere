/**
 * How long an upload may take before the browser gives up. The shared client waits 15 s, which is
 * too short here: one upload makes several calls to the CMS and the database in a row (read the
 * old file, upload the new one, save it, delete the old one), and each can take a few seconds.
 * Giving up early would show "Could not reach the server" while the server was still working.
 */
export const UPLOAD_TIMEOUT_MS = 60_000;

/**
 * The request that uploads one file, or several in the same request, as multipart/form-data: a
 * cover, a photo, a batch of gallery images. `field` is the form field the server reads the files
 * from (several files are several parts with the same field name, in the order given). The JSON
 * content type of the shared client is cleared, so the browser sets `multipart/form-data` with its
 * boundary itself (a hand-set header would lack the boundary and the server could not read the
 * body). It waits up to UPLOAD_TIMEOUT_MS for the answer, longer than any other request.
 *
 * Pass the result to `apiRequest`, with the schema of the answer.
 */
export function fileUploadRequest(
  url: string,
  field: string,
  files: File | readonly File[],
) {
  const data = new FormData();
  for (const file of Array.isArray(files) ? files : [files]) {
    data.append(field, file);
  }
  return {
    method: "POST",
    url,
    data,
    headers: { "Content-Type": undefined },
    timeout: UPLOAD_TIMEOUT_MS,
  } as const;
}
