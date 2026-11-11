import { Building2 } from "lucide-react";
import { getImageProps } from "next/image";
import { galleryPhotos, type Photo } from "@/lib/hotel/gallery";
import type { HotelImage } from "@/lib/content/types";

/** A 1x1 transparent GIF: what a thumbnail's <img> holds on a phone, so no request is made for it there. */
const BLANK = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/**
 * Aspect boxes are fixed, so photos arriving later never move the page. On a phone only the lead photo shows, with
 * the photo count under it; the thumbnails appear from the `sm` breakpoint (640 px) up and are only fetched there.
 */
export function Gallery({ images }: { images: HotelImage[] }) {
  const { photos, total } = galleryPhotos(images);

  if (photos.length === 0) {
    return (
      <div role="img" aria-label="No photos are available for this hotel yet" className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-3 rounded-2xl bg-muted text-muted-foreground sm:aspect-[21/9]">
        <Building2 aria-hidden className="size-10" strokeWidth={1.25} />
        <span className="text-sm">Photos are not available for this hotel yet.</span>
      </div>
    );
  }

  const [first, ...rest] = photos;
  return (
    <section aria-label="Photos" className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <div className="relative col-span-2 aspect-[64/35] overflow-hidden rounded-2xl bg-muted sm:row-span-2 sm:aspect-[4/3]">
          <LeadPhoto photo={first!} />
        </div>
        {rest.map((p) => (
          <div key={p.n} className="relative hidden aspect-[4/3] overflow-hidden rounded-xl bg-muted sm:block">
            <Thumbnail photo={p} />
          </div>
        ))}
      </div>
      {total > 1 && <p className="text-sm text-muted-foreground sm:hidden">{total} photos</p>}
      {total > photos.length && <p className="hidden text-sm text-muted-foreground sm:block">Showing {photos.length} of {total} photos.</p>}
    </section>
  );
}

const IMG_CLASS = "absolute inset-0 size-full object-cover";

/**
 * A thumbnail. Hiding it with CSS alone would not stop the download, so the photo itself sits in a <source> that only
 * matches from 640 px up; below that the <img> keeps an inline blank and the browser requests nothing.
 */
function Thumbnail({ photo }: { photo: Photo }) {
  return (
    <picture>
      <source media="(min-width: 640px)" srcSet={photo.small} />
      <img src={BLANK} alt={photo.alt} loading="lazy" decoding="async" fetchPriority="low" className={IMG_CLASS} />
    </picture>
  );
}

/**
 * The lead photo, as plain server-rendered markup so the browser finds it in the first HTML. Phones get the supplier's
 * 640x350 crop, from 640 px up the 1024x768 one, so each box keeps its own crop. When the URL is on the allowed supplier
 * host, both go through Next's image optimiser (AVIF or WebP, a width picked from `sizes`); otherwise they are plain files.
 */
function LeadPhoto({ photo }: { photo: Photo }) {
  if (!photo.optimised) {
    return (
      <picture>
        <source media="(min-width: 640px)" srcSet={photo.large} width={1024} height={768} />
        <img src={photo.medium} width={640} height={350} alt={photo.alt} loading="eager" fetchPriority="high" decoding="async" className={IMG_CLASS} />
      </picture>
    );
  }
  // The box is almost the full width on a phone (100vw is the safe over-estimate); half the content width from 640 px up, at most 480 px.
  const phone = getImageProps({ src: photo.medium, width: 640, height: 350, alt: photo.alt, sizes: "100vw", loading: "eager", fetchPriority: "high", decoding: "async", className: IMG_CLASS });
  const desktop = getImageProps({ src: photo.large, width: 1024, height: 768, alt: photo.alt, sizes: "(min-width: 1024px) 480px, 50vw" });
  return (
    <picture>
      <source media="(min-width: 640px)" srcSet={desktop.props.srcSet} sizes={desktop.props.sizes} width={1024} height={768} />
      <img {...phone.props} alt={photo.alt} />
    </picture>
  );
}
