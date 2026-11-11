import { Building2 } from "lucide-react";
import Image from "next/image";
import { galleryPhotos } from "@/lib/hotel/gallery";
import type { HotelImage } from "@/lib/content/types";

/** Aspect boxes are fixed, so photos arriving later never move the page. */
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
        <div className="relative col-span-2 aspect-[4/3] overflow-hidden rounded-2xl bg-muted sm:row-span-2">
          <Image src={first!.large} alt={first!.alt} fill unoptimized loading="eager" fetchPriority="high" sizes="(min-width: 1024px) 512px, 100vw" className="object-cover" />
        </div>
        {rest.map((p) => (
          <div key={p.n} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
            <Image src={p.small} alt={p.alt} fill unoptimized loading="lazy" fetchPriority="low" sizes="(min-width: 1024px) 250px, 50vw" className="object-cover" />
          </div>
        ))}
      </div>
      {total > photos.length && <p className="text-sm text-muted-foreground">Showing {photos.length} of {total} photos.</p>}
    </section>
  );
}
