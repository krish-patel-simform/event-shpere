"use client";

import { ImageOff } from "lucide-react";
import { useCallback, useState } from "react";
import { cn } from "./cn";

type Status = "loading" | "loaded" | "failed";

type LoadingImageProps = {
  src: string;
  alt: string;
  /** Extra classes for the <img> itself. */
  className?: string;
  loading?: "eager" | "lazy";
};

/**
 * A picture that never leaves a bare box. It fills the box it is put in (the parent must have a
 * size: a fixed height or an aspect ratio, which also stops the page shifting when the picture
 * arrives). Until the picture has loaded a pulsing skeleton fills that box; then the picture fades
 * in over it. A picture that can not be loaded is replaced by a quiet "not available" box.
 * `data-state` says which of the three it is.
 *
 * A plain <img>: the pictures come from the CMS host, which next/image would have to be configured
 * for. The API only sends http(s) URLs.
 */
export function LoadingImage({ src, ...props }: LoadingImageProps) {
  // A new picture (the cover was replaced) starts from loading again.
  return <ImageBox key={src} src={src} {...props} />;
}

function ImageBox({ src, alt, className, loading }: LoadingImageProps) {
  const [status, setStatus] = useState<Status>("loading");

  // A picture that came from the browser cache can be complete before React attaches onLoad.
  const check = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete && image.naturalWidth > 0) setStatus("loaded");
  }, []);

  return (
    <div data-state={status} className="relative size-full overflow-hidden">
      {status === "loading" && (
        <div
          aria-hidden="true"
          className="absolute inset-0 animate-pulse bg-skeleton motion-reduce:animate-none"
        />
      )}
      {status === "failed" ? (
        <div
          role="img"
          aria-label={alt}
          className="absolute inset-0 grid place-items-center bg-surface-subtle text-muted"
        >
          <span className="flex flex-col items-center gap-1 text-xs">
            <ImageOff aria-hidden="true" className="size-5" />
            Image not available
          </span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={check}
          src={src}
          alt={alt}
          loading={loading}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("failed")}
          className={cn(
            "size-full object-cover transition-opacity duration-300 motion-reduce:transition-none",
            status === "loaded" ? "opacity-100" : "opacity-0",
            className,
          )}
        />
      )}
    </div>
  );
}
