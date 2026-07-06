// src/features/tenant/pages/Room.tsx
import React from 'react'
import { Helmet } from 'react-helmet-async'
import { BedDouble, Users, Layers, MapPin, FileText } from 'lucide-react'
import { useTenantRoom } from '../hooks/index'
import { PageHeader, SectionCard, StatusBadge, ProgressBar } from '@/components/ui'
import { SmartImage } from '@/components/media'
import type { OptimizedUrls } from '@/services/media'

type RoomStat = {
  icon: typeof MapPin
  label: string
  value: string
}

type RoomImage = string | {
  optimized_urls?: OptimizedUrls
  uuid?: string
  alt_text?: string | null
  dominant_color?: string | null
  is_cover?: boolean
  dimensions?: Record<string, unknown> | null
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function roomFromResponse(data: unknown): Record<string, unknown> | undefined {
  const response = recordValue(data)
  if (!response) return undefined
  if ('room' in response) return recordValue(response.room)
  const nestedData = recordValue(response.data)
  if (nestedData && 'room' in nestedData) return recordValue(nestedData.room)
  return response
}

function imageUrl(image?: RoomImage | null): string | null {
  if (!image) return null
  if (typeof image === 'string') return image

  return image.optimized_urls?.medium ||
    image.optimized_urls?.large ||
    image.optimized_urls?.original ||
    null
}

export default function TenantRoom(): React.ReactElement {
  const { data, isLoading } = useTenantRoom()
  const rawResponse = recordValue(data)
  const response = recordValue(rawResponse?.data) ?? rawResponse
  const room = roomFromResponse(data)

  if (isLoading) {
    return (
      <div className="p-6">
        <PageHeader title="My Room" />
        <div className="space-y-4">
          {[1,2].map(i => (
            <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
              {[1,2,3,4].map(j => <div key={j} className="h-4 bg-muted rounded animate-pulse" />)}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="p-6">
        <PageHeader title="My Room" />
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <BedDouble className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No room assigned</p>
          <p className="text-xs text-muted-foreground mt-1">A room will appear here once your lease is active.</p>
        </div>
      </div>
    )
  }

  const images = (room.images as RoomImage[] | undefined) ?? []
  const gallery = Array.isArray(room.media) ? room.media as RoomImage[] : []
  const coverImage = (room.cover_image as RoomImage | undefined) ?? gallery[0] ?? images[0]
  const roomImage = imageUrl(room.cover_image as RoomImage | undefined) ||
    imageUrl(gallery[0]) ||
    imageUrl(images[0])
  const visibleGallery = gallery.filter((item) => imageUrl(item))
  const amenities = (room.amenities as string[]) ?? []
  const facilities = (room.facilities as Array<Record<string, string>>) ?? []
  const houseRules = (room.house_rules as Array<Record<string, string>>) ?? []
  const lease = recordValue(response?.lease ?? room.lease)
  const property = recordValue(response?.property ?? room.property) as Record<string, string> | undefined
  const bed = recordValue(response?.bed ?? room.bed)
  const occupancyPct = room.capacity
    ? Math.round(((room.current_occupants as number) / (room.capacity as number)) * 100)
    : 0
  const stats: RoomStat[] = [
    { icon: MapPin,    label: 'Block',    value: room.block ? `Block ${String(room.block)}` : '—' },
    { icon: Layers,    label: 'Floor',    value: room.floor ? String(room.floor) : '—' },
    { icon: BedDouble, label: 'Beds',     value: `${String(room.current_occupants ?? 0)} / ${String(room.capacity ?? 0)}` },
    { icon: Users,     label: 'Occupancy', value: `${occupancyPct}%` },
  ]
  const amenitiesNode: React.ReactNode = amenities.length > 0 ? (
    <SectionCard title="Room Amenities">
      <div className="flex flex-wrap gap-2">
        {amenities.map((amenity) => (
          <span key={amenity} className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground capitalize">
            {amenity.replace(/_/g, ' ')}
          </span>
        ))}
      </div>
    </SectionCard>
  ) : null
  const facilitiesNode: React.ReactNode = facilities.length > 0 ? (
    <SectionCard title="Property Facilities">
      <div className="flex flex-wrap gap-2">
        {facilities.map((facility) => {
          const name = facility.name ?? 'Facility'

          return (
            <span key={facility.id ?? name} className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground">
              {name}
            </span>
          )
        })}
      </div>
    </SectionCard>
  ) : null
  const rulesNode: React.ReactNode = houseRules.length > 0 ? (
    <SectionCard title="House Rules">
      <ul className="space-y-2">
        {houseRules.map((rule, index) => {
          const label = rule.rule ?? rule.name ?? String(index + 1)

          return (
            <li key={rule.id ?? index} className="flex items-start gap-2 text-xs text-foreground">
              <span className="text-primary mt-0.5 shrink-0">•</span>
              <span>{label}</span>
            </li>
          )
        })}
      </ul>
    </SectionCard>
  ) : null
  const leaseRows: Array<[string, string | null]> = lease ? [
    ['Lease Number', lease.lease_number ? String(lease.lease_number) : null],
    ['Monthly Rent', lease.monthly_rent ? `KES ${Number(lease.monthly_rent).toLocaleString()}` : null],
    ['Status', lease.status ? String(lease.status) : null],
  ] : []
  const leaseNode: React.ReactNode = lease ? (
    <SectionCard title="Lease Details">
      {leaseRows.filter(([, value]) => Boolean(value)).map(([label, value]) => (
        <div key={label} className="flex justify-between py-2 border-b border-border last:border-0">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-xs font-medium text-foreground capitalize">{String(value).replace(/_/g, ' ')}</span>
        </div>
      ))}
    </SectionCard>
  ) : null
  const bedNode: React.ReactNode = bed ? (
    <SectionCard title="Bed Details">
      {Object.entries(bed).filter(([, value]) => value !== null && value !== undefined && value !== '').map(([label, value]) => (
        <div key={label} className="flex justify-between py-2 border-b border-border last:border-0">
          <span className="text-xs text-muted-foreground capitalize">{label.replace(/_/g, ' ')}</span>
          <span className="text-xs font-medium text-foreground">{String(value)}</span>
        </div>
      ))}
    </SectionCard>
  ) : (
    <SectionCard title="Bed Details">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BedDouble className="h-3.5 w-3.5" />
        <span>No specific bed assigned.</span>
      </div>
    </SectionCard>
  )
  const propertyNode: React.ReactNode = property ? (
    <SectionCard title="Property Contact">
      {[
        ['Property', property.name],
        ['Address', property.address],
        ['City', property.city],
        ['Phone', property.phone],
        ['Email', property.email],
      ].filter(([, value]) => Boolean(value)).map(([label, value]) => (
        <div key={label} className="flex justify-between py-2 border-b border-border last:border-0">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-xs font-medium text-foreground">{value}</span>
        </div>
      ))}
    </SectionCard>
  ) : null

  return (
    <>
      <Helmet><title>My Room — StayLynk</title></Helmet>
      <div className="p-6 max-w-[1000px] space-y-4">
        <PageHeader
          title="My Room"
          subtitle="Details about your current accommodation."
        />

        {/* Room hero */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {roomImage ? (
            <SmartImage
              src={roomImage}
              fallback={roomImage}
              alt={typeof coverImage === 'string' ? `Room ${room.room_number as string}` : coverImage?.alt_text}
              dominantColor={typeof coverImage === 'string' ? null : coverImage?.dominant_color}
              aspectRatio="16 / 7"
              usage="detail"
              sizes="(max-width: 768px) 100vw, 1000px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-48 bg-muted flex items-center justify-center">
              <BedDouble className="h-12 w-12 text-muted-foreground/30" />
            </div>
          )}

          <div className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">Room {room.room_number as string}</h2>
                <p className="text-sm text-muted-foreground">{(room.room_type as Record<string, string> | null)?.name ?? 'Standard Room'}</p>
              </div>
              <StatusBadge status={room.status as string} />
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {stats.map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-lg bg-muted/40 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="h-3 w-3 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{String(value)}</p>
                </div>
              ))}
            </div>

            {lease && (
              <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium text-foreground">{String(lease.lease_number ?? 'Active lease')}</span>
                {lease.monthly_rent ? <span>KES {Number(lease.monthly_rent).toLocaleString()} / month</span> : null}
                {lease.status ? <StatusBadge status={String(lease.status)} /> : null}
              </div>
            )}

            {/* Occupancy bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>Room occupancy</span>
                <span>{room.current_occupants as number} of {room.capacity as number} occupied</span>
              </div>
              <ProgressBar value={occupancyPct}
                color={occupancyPct >= 100 ? 'bg-red-500' : occupancyPct >= 75 ? 'bg-amber-500' : 'bg-emerald-500'} />
            </div>

            {visibleGallery.length > 0 && (
              <div className="mt-5 border-t border-border pt-4">
                <p className="mb-2 text-xs font-semibold text-foreground">Room gallery</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {visibleGallery.map((item, index) => {
                    const src = imageUrl(item)
                    if (!src) return null

                    return (
                      <div key={typeof item === 'string' ? `${item}-${index}` : item.uuid ?? index} className="h-20 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                        <SmartImage
                          src={src}
                          fallback={src}
                          alt={typeof item === 'string' ? `Room image ${index + 1}` : item.alt_text ?? `Room image ${index + 1}`}
                          dominantColor={typeof item === 'string' ? null : item.dominant_color}
                          aspectRatio="6 / 5"
                          usage="card"
                          sizes="96px"
                          className="object-cover"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Amenities + facilities + rules */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {amenitiesNode}
          {facilitiesNode}
        </div>

        {rulesNode}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {leaseNode}
          {bedNode}
          {propertyNode}
        </div>
      </div>
    </>
  )
}
