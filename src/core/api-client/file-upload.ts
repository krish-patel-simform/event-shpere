/**
 * The request that uploads one file, or several in the same request, as multipart/form-data: a
 * cover, a photo, a batch of gallery images. `field` is the form field the server reads the files
 * from (several files are several parts with the same field name, in the order given). The JSON
 * content type of the shared client is cleared, so the browser sets `multipart/form-data` with its
 * boundary itself (a hand-set header would lack the boundary and the server could not read the
 * body).
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
  } as const;
}
