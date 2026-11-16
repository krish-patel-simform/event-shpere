// Plain data shared by every feature that uploads an image to Strapi (no React, no server code).

/**
 * The multipart wrapper (boundaries, part headers) adds a few hundred bytes around the file, so a
 * request body may be a little bigger than the file's own limit.
 */
export const IMAGE_MULTIPART_OVERHEAD_BYTES = 64 * 1024;
