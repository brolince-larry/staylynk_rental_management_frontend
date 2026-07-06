import type { PublicListing } from '@/api/listings'
import { pickImageUrl } from '@/services/media'

export function buildListingGallery(listing: PublicListing): string[] {
  const rooms = listing.units?.rooms ?? []
  const gallery = [
    listing.media?.cover,
    listing.cover_image,
    ...(listing.media?.gallery || []),
    ...(listing.gallery || []),
    ...rooms.flatMap((room) => [
      room.media?.cover,
      room.cover_image,
      ...(room.media?.gallery || []),
      ...(room.gallery || []),
    ]),
  ].filter(Boolean)

  return [...new Set(gallery.map((item) => pickImageUrl(item, undefined, 'large')))]
}
