import React from 'react'
import { Award, BedDouble, Layers, MapPin, Users } from 'lucide-react'
import type { PublicListing, PublicListingRoom } from '@/api/listings'
import { SmartImage } from '@/components/media'
import { formatCurrency } from '@/utils/format'

interface ListingRoomCardProps {
  room: PublicListingRoom
  listing?: PublicListing
}

function roomTypeLabel(roomType: PublicListingRoom['room_type']): string {
  if (!roomType) return 'Room'
  if (typeof roomType === 'string') return roomType.replace(/_/g, ' ')
  return roomType.name || 'Room'
}

export function ListingRoomCard({ room, listing }: ListingRoomCardProps): React.ReactElement {
  const cover = room.media?.cover ?? room.cover_image ?? listing?.media?.cover ?? listing?.cover_image ?? null
  const fallback = typeof listing?.cover_image === 'string' ? listing.cover_image : undefined
  const isTrusted = listing?.trust?.is_trusted === true

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card">
      <SmartImage
        src={cover}
        fallback={fallback}
        alt={`Room ${room.room_number ?? ''}`}
        usage="card"
        aspectRatio="4 / 3"
        sizes="(max-width: 768px) 90vw, 320px"
        className="object-cover"
      />
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">Room {room.room_number ?? '—'}</p>
              {isTrusted && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                  <Award className="h-3 w-3" /> Trusted Landlord
                </span>
              )}
            </div>
            <p className="text-xs capitalize text-muted-foreground">{roomTypeLabel(room.room_type)}</p>
          </div>
          <p className="text-sm font-bold text-foreground">
            {formatCurrency(Number(room.pricing?.monthly_rent ?? 0))}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Layers className="h-3 w-3" /> {room.floor || '—'}</span>
          <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {room.block || '—'}</span>
          <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {room.capacity ?? 0} capacity</span>
          <span className="inline-flex items-center gap-1"><BedDouble className="h-3 w-3" /> {room.available_beds ?? 0} beds</span>
        </div>
        {room.amenities && room.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {room.amenities.slice(0, 5).map((amenity) => (
              <span key={amenity} className="rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize text-muted-foreground">
                {amenity.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}
