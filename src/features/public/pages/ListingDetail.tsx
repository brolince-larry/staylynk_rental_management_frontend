// src/features/public/pages/ListingDetail.tsx
import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { listingsApi } from '@/api/listings'
import { publicSiteUrl } from '@/config/env'
import type { PublicListing } from '@/api/listings'
import {
  MapPin, Phone, Wifi, Car, Shield, Droplets, Users,
  ChevronLeft, ExternalLink, Navigation, Star, CheckCircle,
  Home, BedDouble, Bath, Building2, ArrowUpRight,
} from 'lucide-react'

// Extended type with detail fields from PublicListingResource
interface ListingDetail extends PublicListing {
  description?: string | null
  id?: string
  specs?: {
    bedrooms?: { min?: number | null; max?: number | null }
    bathrooms?: { min?: number | null; max?: number | null }
  }
  location?: {
    city?: string | null
    county?: string | null
    neighbourhood?: string | null
    address?: string | null
    country?: string | null
    coordinates?: { lat: number; lng: number } | null
    google_maps_url?: string | null
  }
  pricing?: {
    min?: number | null
    max?: number | null
    currency?: string | null
    display?: string | null
  }
  amenities?: string[]
  nearby?: string[]
  features?: {
    water?: boolean
    internet?: boolean
    parking?: boolean
    security_level?: string | null
    family_friendly?: boolean
    student_friendly?: boolean
    quiet?: boolean
    pets_allowed?: boolean
  }
  contact?: {
    whatsapp?: string | null
  }
  trust?: {
    is_verified?: boolean
    is_trusted?: boolean
    verification_status?: string | null
    review_count?: number
    property_rating?: number
    landlord_rating?: number
  }
  visibility?: {
    is_featured?: boolean
    is_boosted?: boolean
    is_available?: boolean
    published_at?: string | null
    published_ago?: string | null
  }
  media?: {
    cover?: string | null
    gallery?: (string | null)[]
    videos?: Array<{ id: string; video_url: string | null; thumbnail_url: string | null }>
  }
  units?: {
    available?: number
    total?: number
    rooms?: Array<{
      id: string | number
      room_number?: string | null
      room_type?: { name?: string | null } | string | null
      floor?: string | null
      block?: string | null
      pricing?: { monthly_rent?: number | null }
      capacity?: number | null
    }>
  }
}

function coverSrc(media: ListingDetail['media'], fallback?: string | null): string | null {
  return (typeof media?.cover === 'string' ? media.cover : null) ?? (typeof fallback === 'string' ? fallback : null)
}

function gallerySrcs(media: ListingDetail['media']): string[] {
  return (media?.gallery ?? []).filter((g): g is string => typeof g === 'string')
}

function formatKes(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return 'KES ' + n.toLocaleString()
}

function mapsSearchEmbedUrl(title: string): string {
  return `https://maps.google.com/maps?q=${encodeURIComponent(title)}&z=17&output=embed`
}

function directionsUrl(title: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(title)}&travelmode=transit`
}

function nearbyUrl(type: string, title: string): string {
  return `https://www.google.com/maps/search/${encodeURIComponent(`${type} near ${title}`)}`
}

function whatsappUrl(number: string, name: string): string {
  const msg = encodeURIComponent(`Hi! I'm interested in viewing ${name}. Is it still available?`)
  const clean = number.replace(/\D/g, '')
  const intl = clean.startsWith('0') ? '254' + clean.slice(1) : clean
  return `https://wa.me/${intl}?text=${msg}`
}

function FeatureChip({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
      {icon}
      {label}
    </span>
  )
}

export default function ListingDetail(): React.ReactElement {
  const { slug } = useParams<{ slug: string }>()
  const [listing, setListing] = useState<ListingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [galleryIdx, setGalleryIdx] = useState(0)

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    listingsApi.publicShow(slug)
      .then((res) => {
        const raw = (res as { data?: ListingDetail }).data ?? res as unknown as ListingDetail
        setListing(raw)
      })
      .catch(() => setError('Listing not found or no longer available.'))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="h-72 w-full animate-pulse rounded-2xl bg-muted" />
          <div className="mt-6 space-y-4">
            <div className="h-8 w-2/3 animate-pulse rounded-lg bg-muted" />
            <div className="h-5 w-1/3 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !listing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <Home className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-lg font-semibold text-foreground">{error ?? 'Listing not found'}</p>
        <a href={`${publicSiteUrl}/hunter`} className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <ChevronLeft className="h-4 w-4" /> Back to search
        </a>
      </div>
    )
  }

  const loc         = listing.location
  const coords      = loc?.coordinates
  const pricing     = listing.pricing
  const features    = listing.features
  const trust       = listing.trust
  const units       = listing.units
  const rooms       = units?.rooms ?? []
  const whatsapp    = listing.contact?.whatsapp
  const gallery     = gallerySrcs(listing.media)
  const cover       = coverSrc(listing.media)
  const allImages   = cover ? [cover, ...gallery.filter((g) => g !== cover)] : gallery
  const currentImg  = allImages[galleryIdx] ?? null

  const NEARBY_TYPES = ['Hospital', 'School', 'Market', 'Supermarket', 'Matatu Stage', 'Mosque', 'Church', 'Bank', 'Petrol Station', 'Pharmacy']

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-3">
          <a href={`${publicSiteUrl}/hunter`} className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" /> Back
          </a>
          <span className="mx-1 text-border">·</span>
          <span className="text-sm font-semibold text-foreground truncate">{listing.title}</span>
          {trust?.is_trusted && (
            <span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[0.68rem] font-semibold text-emerald-700">
              <CheckCircle className="h-3 w-3" /> Trusted
            </span>
          )}
          {trust?.is_verified && !trust.is_trusted && (
            <span className="ml-auto flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[0.68rem] font-semibold text-blue-700">
              <Shield className="h-3 w-3" /> Verified
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 space-y-8">

        {/* ── Gallery ── */}
        {allImages.length > 0 ? (
          <section>
            <div className="relative overflow-hidden rounded-2xl bg-muted">
              <img
                src={currentImg ?? ''}
                alt={listing.title}
                className="h-72 w-full object-cover sm:h-96"
              />
              {allImages.length > 1 && (
                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                  {allImages.slice(0, 8).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setGalleryIdx(i)}
                      className={`h-1.5 rounded-full transition-all ${i === galleryIdx ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`}
                    />
                  ))}
                </div>
              )}
            </div>
            {allImages.length > 1 && (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {allImages.slice(0, 6).map((src, i) => (
                  <button key={i} type="button" onClick={() => setGalleryIdx(i)}
                    className={`h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition ${i === galleryIdx ? 'border-primary' : 'border-transparent'}`}>
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : (
          <div className="flex h-56 items-center justify-center rounded-2xl bg-muted">
            <Building2 className="h-16 w-16 text-muted-foreground/30" />
          </div>
        )}

        {/* ── Title + Price ── */}
        <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{listing.title}</h1>
            </div>
            {loc?.city && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                {[loc.neighbourhood, loc.city, loc.country === 'KE' ? 'Kenya' : loc.country].filter(Boolean).join(', ')}
              </p>
            )}
            {listing.house_type && (
              <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold capitalize text-primary">
                {listing.house_type.replace(/_/g, ' ')}
              </span>
            )}
          </div>

          <div className="shrink-0 rounded-xl border border-border bg-card p-4 text-center shadow-sm">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">Monthly Rent</p>
            <p className="mt-0.5 text-xl font-bold text-foreground">
              {pricing?.display ?? (pricing?.min ? formatKes(pricing.min) : '—')}
            </p>
            {units?.available !== undefined && (
              <p className="mt-1 text-xs text-muted-foreground">
                {units.available} of {units.total} units available
              </p>
            )}
          </div>
        </section>

        {/* ── Description ── */}
        {listing.description && (
          <section className="prose prose-sm max-w-none text-muted-foreground">
            <p>{listing.description}</p>
          </section>
        )}

        {/* ── Specs ── */}
        {(listing.specs?.bedrooms || listing.specs?.bathrooms) && (
          <section className="flex flex-wrap gap-3">
            {listing.specs.bedrooms?.min != null && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3">
                <BedDouble className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  {listing.specs.bedrooms.min === listing.specs.bedrooms.max
                    ? `${listing.specs.bedrooms.min} bed`
                    : `${listing.specs.bedrooms.min}–${listing.specs.bedrooms.max} beds`}
                </span>
              </div>
            )}
            {listing.specs.bathrooms?.min != null && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3">
                <Bath className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  {listing.specs.bathrooms.min === listing.specs.bathrooms.max
                    ? `${listing.specs.bathrooms.min} bath`
                    : `${listing.specs.bathrooms.min}–${listing.specs.bathrooms.max} baths`}
                </span>
              </div>
            )}
          </section>
        )}

        {/* ── MAP + Location ── */}
        <section className="space-y-4">
          <h2 className="text-base font-bold text-foreground">Location</h2>
          {(listing.title && (coords || loc?.city)) ? (
            <div className="overflow-hidden rounded-2xl border border-border">
              <iframe
                title="Property location"
                src={mapsSearchEmbedUrl(listing.title)}
                width="100%"
                height="280"
                className="border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          ) : listing.title ? (
            <div className="flex h-32 items-center justify-center rounded-2xl border border-border bg-muted/40">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.title ?? '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
              >
                <MapPin className="h-4 w-4" /> View on Google Maps <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {(listing.title) && (
              <a
                href={directionsUrl(listing.title)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
              >
                <Navigation className="h-4 w-4 text-primary" /> Get Directions
              </a>
            )}
            {listing.title && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.title ?? '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
              >
                <MapPin className="h-4 w-4 text-primary" /> Open in Google Maps <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </section>

        {/* ── Nearby Places ── */}
        {listing.title && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-foreground">Nearby Places</h2>
            <p className="text-xs text-muted-foreground">Explore what's around this property in {loc?.city ?? 'the area'}</p>
            <div className="flex flex-wrap gap-2">
              {(listing.nearby && listing.nearby.length > 0 ? listing.nearby : NEARBY_TYPES).map((place) => (
                <a
                  key={place}
                  href={nearbyUrl(place, listing.title)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted hover:border-primary/40"
                >
                  {place} <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ── Features ── */}
        {features && Object.values(features).some(Boolean) && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-foreground">Features</h2>
            <div className="flex flex-wrap gap-2">
              {features.water       && <FeatureChip icon={<Droplets className="h-3.5 w-3.5 text-blue-500" />}   label="Water Available" />}
              {features.internet    && <FeatureChip icon={<Wifi className="h-3.5 w-3.5 text-sky-500" />}       label="Internet / WiFi" />}
              {features.parking     && <FeatureChip icon={<Car className="h-3.5 w-3.5 text-slate-500" />}      label="Parking" />}
              {features.family_friendly && <FeatureChip icon={<Users className="h-3.5 w-3.5 text-purple-500" />} label="Family Friendly" />}
              {features.student_friendly && <FeatureChip icon={<Users className="h-3.5 w-3.5 text-indigo-500" />} label="Student Friendly" />}
              {features.pets_allowed && <FeatureChip label="Pets Allowed" />}
              {features.quiet       && <FeatureChip label="Quiet Environment" />}
              {features.security_level && features.security_level !== 'low' && (
                <FeatureChip icon={<Shield className="h-3.5 w-3.5 text-green-500" />} label={`${features.security_level} security`.replace(/\b\w/g, (c) => c.toUpperCase())} />
              )}
            </div>
          </section>
        )}

        {/* ── Amenities ── */}
        {listing.amenities && listing.amenities.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-foreground">Amenities</h2>
            <div className="flex flex-wrap gap-2">
              {listing.amenities.map((a) => (
                <span key={a} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium capitalize text-foreground">
                  {a.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* ── Available Rooms ── */}
        {rooms.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-foreground">Available Units</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {rooms.slice(0, 6).map((room) => {
                const typeName = typeof room.room_type === 'object' && room.room_type !== null
                  ? (room.room_type as { name?: string | null }).name ?? 'Room'
                  : typeof room.room_type === 'string' ? room.room_type : 'Room'
                return (
                  <div key={room.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground capitalize">{typeName}</p>
                        {room.room_number && <p className="text-xs text-muted-foreground">Unit {room.room_number}</p>}
                        {room.floor && <p className="text-xs text-muted-foreground">Floor {room.floor}{room.block ? ` · Block ${room.block}` : ''}</p>}
                      </div>
                      {room.pricing?.monthly_rent && (
                        <p className="text-sm font-bold text-foreground">{formatKes(room.pricing.monthly_rent)}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Trust ── */}
        {trust && (trust.property_rating ?? 0) > 0 && (
          <section className="rounded-xl border border-border bg-card p-4 space-y-2">
            <h2 className="text-sm font-bold text-foreground">Ratings &amp; Reviews</h2>
            <div className="flex flex-wrap gap-4">
              <div>
                <p className="text-[0.7rem] text-muted-foreground uppercase tracking-wide">Property</p>
                <p className="flex items-center gap-1 text-lg font-bold text-foreground">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  {(trust.property_rating ?? 0).toFixed(1)}
                </p>
              </div>
              {(trust.landlord_rating ?? 0) > 0 && (
                <div>
                  <p className="text-[0.7rem] text-muted-foreground uppercase tracking-wide">Landlord</p>
                  <p className="flex items-center gap-1 text-lg font-bold text-foreground">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    {(trust.landlord_rating ?? 0).toFixed(1)}
                  </p>
                </div>
              )}
              {(trust.review_count ?? 0) > 0 && (
                <div>
                  <p className="text-[0.7rem] text-muted-foreground uppercase tracking-wide">Reviews</p>
                  <p className="text-lg font-bold text-foreground">{trust.review_count}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── CTA ── */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-base font-bold text-foreground">Interested in this property?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Contact the landlord directly to schedule a viewing or ask questions.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {whatsapp ? (
              <a
                href={whatsappUrl(whatsapp, listing.title)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
              >
                <Phone className="h-4 w-4" /> WhatsApp Landlord
              </a>
            ) : null}
            <a
              href={`${publicSiteUrl}/hunter`}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" /> Find More Listings
            </a>
          </div>
        </section>

      </main>
    </div>
  )
}
