// src/schemas/property.schema.ts
import { z } from 'zod'

const moneyValue = (schema: z.ZodNumber) => z.preprocess((value) => {
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '')
    return cleaned ? Number(cleaned) : value
  }
  return value
}, schema)

const HOUSE_TYPES = [
  'apartment',
  'maisonette',
  'bungalow',
  'townhouse',
  'villa',
  'detached_house',
  'semi_detached',
  'hostel',
  'guest_house',
  'commercial_other',
] as const

const houseTypesSchema = z.array(z.enum(HOUSE_TYPES)).default([])
// Unit type (Rooms.tsx) is freeform on the backend — StoreRoomRequest /
// UpdateRoomRequest resolve house_type into a RoomType row by name,
// creating one if it doesn't exist yet, so there's no fixed enum to
// validate against here. UNIT_TYPE_OPTIONS just supplies curated choices.
const roomHouseTypeSchema = z.preprocess(
  (value) => value === '' || value === null ? undefined : value,
  z.string({
    required_error: 'Unit type is required',
    invalid_type_error: 'Unit type is required',
  }).min(1, 'Unit type is required')
)

const optionalListingNumber = z.preprocess(
  (value) => value === '' || value === null ? undefined : value,
  z.coerce.number().min(0).optional()
)

export const propertySchema = z.object({
  name:          z.string().min(2, 'Name is required').max(150),
  address:       z.string().min(5, 'Address is required').max(300),
  city:          z.string().min(2, 'City is required').max(100),
  county:        z.string().max(100).optional(),
  state:         z.string().max(100).optional(),
  country:       z.string().length(2).optional(),
  phone:         z.string().max(20).optional(),
  email:         z.string().email('Invalid email').optional().or(z.literal('')),
  description:   z.string().max(2000).optional(),
  total_floors:  z.coerce.number().int().min(1).max(200).optional(),
  status:        z.enum(['active', 'inactive', 'maintenance']).default('active'),
  latitude:      z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude:     z.coerce.number().min(-180).max(180).optional().nullable(),
  listing:       z.object({
    house_types:         houseTypesSchema,
    rent_min:            optionalListingNumber,
    rent_max:            optionalListingNumber,
    bedrooms_min:        optionalListingNumber,
    bedrooms_max:        optionalListingNumber,
    bathrooms_min:       optionalListingNumber,
    bathrooms_max:       optionalListingNumber,
    neighbourhood:       z.string().max(150).optional(),
    amenities:           z.array(z.string()).default([]),
    water_available:     z.boolean().default(false),
    internet_available:  z.boolean().default(false),
    parking_available:   z.boolean().default(false),
    security_level:      z.enum(['low', 'standard', 'high', 'gated']).default('standard'),
    is_available:        z.boolean().default(true),
  }).optional(),
})
export type PropertySchema = z.infer<typeof propertySchema>

export const roomSchema = z.object({
  room_type_id:     z.coerce.number().int().positive().optional(),
  house_type:       roomHouseTypeSchema,
  room_number:      z.string().min(1, 'Room number is required').max(20),
  number_of_rooms:  z.coerce.number().int().min(1).max(100).default(1),
  rooms_per_floor:  z.preprocess(
    (value) => value === '' || value === null ? undefined : value,
    z.coerce.number().int().min(1).max(100).optional()
  ),
  floor:            z.string().max(20).optional(),
  block:            z.string().max(50).optional(),
  monthly_rent:     moneyValue(z.coerce.number().positive('Rent must be greater than 0')),
  security_deposit: moneyValue(z.coerce.number().min(0)).optional(),
  capacity:         z.coerce.number().int().min(1).max(20).default(1),
  status:           z.preprocess(
    (value) => typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, '_') : value,
    z.enum(['available', 'occupied', 'maintenance', 'reserved']).default('available')
  ),
  notes:            z.string().max(1000).optional(),
})
export type RoomSchema = z.infer<typeof roomSchema>
