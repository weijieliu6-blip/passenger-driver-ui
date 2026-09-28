import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// 客戶端（瀏覽器端使用）
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 服務端客戶端（API 路由中使用）
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey
export const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// ============= 枚舉類型 =============

export type OrderStatus = 'pending' | 'grabbed' | 'price_confirmed' | 'completed' | 'cancelled' | 'expired'
export type VehicleType = '4_seat' | '7_seat' | '8_seat'
export type TripDirection = 'to_mainland' | 'to_hk'
export type ChildType = 'infant' | 'over_3'
export type PriceCurrency = 'HKD' | 'CNY'
export type MembershipTier = 'gold' | 'platinum' | 'normal' | 'none'
export type UserRole = 'passenger' | 'driver' | 'admin'

// ============= 介面定義 =============

export interface User {
  id: string
  role: UserRole
  phone: string
  name: string
  avatar_url?: string | null
  created_at: string
}

export interface DriverProfile {
  id: string
  user_id: string
  membership_tier: MembershipTier
  rating: number
  vehicle_plate: string
  vehicle_type: string
  max_passengers: number
  max_luggage: number
  created_at: string
}

/**
 * driver_info 表 - 司機詳細資料（公開）
 */
export interface DriverInfo {
  id: string                    // 對應 public.users.id
  vehicle_plate: string         // 車牌
  vehicle_model?: string | null // 車輛型號（如 Toyota Alphard）
  driving_years: number         // 駕齡
  total_orders: number          // 已接單數
  total_rating_sum: number      // 評分合計
  total_rating_count: number    // 評分人數
  rating: number                // 平均評分
  created_at: string
  updated_at: string
}

export interface Order {
  id: number
  created_at: string
  updated_at: string

  order_number: string
  status: OrderStatus

  grab_token: string
  grab_token_expires_at: string

  direction: TripDirection
  pickup_location: string
  pickup_area?: string | null
  dropoff_location: string
  dropoff_area?: string | null
  departure_time: string

  passengers: number
  luggage: number
  vehicle_type: VehicleType
  is_charter: boolean

  has_child: boolean
  child_type?: ChildType | null

  passenger_id?: string | null
  passenger_name?: string | null
  passenger_phone: string
  passenger_notes?: string | null

  // 司機信息（搶單後填寫）
  driver_id?: string | null          // 綁定司機用戶 ID
  driver_name?: string | null
  driver_phone?: string | null
  driver_plate?: string | null
  driver_notes?: string | null
  grabbed_at?: string | null

  // 價格信息
  estimated_fare?: number | null     // 乘客下單時預估車資
  confirmed_price?: number | null    // 司機確認的最終價格
  price_currency?: PriceCurrency     // 幣種 HKD/CNY
  price_confirmed_at?: string | null // 價格確認時間

  completed_at?: string | null
  cancelled_at?: string | null
  cancel_reason?: string | null
  rating?: number | null
  rated_at?: string | null
}

// 創建訂單的輸入類型
export interface CreateOrderInput {
  direction: TripDirection
  pickup_location: string
  pickup_area?: string
  dropoff_location: string
  dropoff_area?: string
  departure_time: string
  passengers: number
  luggage: number
  vehicle_type: VehicleType
  is_charter: boolean
  has_child: boolean
  child_type?: ChildType
  passenger_name?: string
  passenger_phone: string
  passenger_notes?: string
}

// 搶單的輸入類型
export interface GrabOrderInput {
  driver_name: string
  driver_phone: string
  driver_plate: string
  driver_notes?: string
}

/**
 * 司機報價輸入
 */
export interface ConfirmPriceInput {
  confirmed_price: number
  price_currency: PriceCurrency
  vehicle_model?: string
  driving_years?: number
}
