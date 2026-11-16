/**
 * Counts bytes while a request body streams through (e.g. on to Strapi) and cuts it off past
 * the limit. Needed even with a content-length check: that header can be missing (chunked)
 * or lie. After a failed pipe, `exceeded()` tells "too big" apart from "the other side broke".
 */
export function createByteLimit(maxBytes: number) {
  let total = 0;
  let exceeded = false;
  const stream = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      total += chunk.byteLength;
      if (total > maxBytes) {
        exceeded = true;
        controller.error(new Error(`Upload is larger than ${maxBytes} bytes`));
        return;
      }
      controller.enqueue(chunk);
    },
  });
  return { stream, exceeded: () => exceeded };
}
