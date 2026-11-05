import "server-only";
import type { CmsMedia, StrapiMedia } from "../schemas/strapi-common.schemas";

/**
 * Strapi's image → ours, the same for every content type (event page, speaker, session detail):
 * local uploads come back as "/uploads/x.jpg", so the URL is made absolute for the browser, and
 * missing fields become null.
 */
export function createCmsMediaMapper(baseUrl: string) {
  /** Local uploads come back as "/uploads/x.jpg": make them absolute so the browser can load them. */
  function absoluteUrl(url: string): string {
    if (/^https?:\/\//i.test(url)) return url;
    return `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
  }

  function toCmsMedia(media: StrapiMedia): CmsMedia {
    return {
      id: media.id,
      url: absoluteUrl(media.url),
      alt: media.alternativeText || null,
      width: media.width ?? null,
      height: media.height ?? null,
    };
  }

  return { absoluteUrl, toCmsMedia };
}
