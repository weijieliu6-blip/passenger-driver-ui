// 司機即時位置 / 行程事件型別（與 supabase migrations 20260929_driver_tracking.sql 對齊）

export interface DriverLocationRow {
  driver_id: string
  lat: number
  lng: number
  heading?: number | null
  speed?: number | null
  accuracy?: number | null
  order_number?: string | null
  updated_at: string
}

export type RideEventType =
  | 'status_changed'
  | 'message'
  | 'driver_arrived'
  | 'driver_picked_up'
  | 'trip_started'
  | 'trip_completed'
  | 'price_confirmed'

export interface RideEvent {
  id: number
  order_number: string
  actor_role: 'passenger' | 'driver' | 'system'
  event_type: RideEventType
  payload: Record<string, unknown>
  created_at: string
}

/**
 * 司機裝置回報 payload（POST /api/driver/location body）
 */
export interface DriverLocationPing {
  lat: number
  lng: number
  heading?: number | null
  speed?: number | null
  accuracy?: number | null
  order_number?: string | null
}
