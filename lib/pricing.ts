// 價格計算邏輯 (MVP: 固定價格表)

export interface PricingParams {
  pickupLocation: string
  dropoffLocation: string
  vehicleType: string
  maxPassengers: number
}

// 固定價格表 (港幣)
const FIXED_PRICES: Record<string, number> = {
  'hong-kong-to-shanwei': 800,
  'shanwei-to-hong-kong': 800,
}

/**
 * 計算訂單預估價格
 * MVP 階段使用固定價格
 * 未來可擴展為動態定價 (距離、時間、需求等因素)
 */
export function calculatePrice(params: PricingParams): number {
  const { pickupLocation, dropoffLocation } = params
  
  // 簡單的路線匹配
  const route = normalizeRoute(pickupLocation, dropoffLocation)
  
  return FIXED_PRICES[route] || 800 // 默認 800 HKD
}

/**
 * 規範化路線字符串
 */
function normalizeRoute(pickup: string, dropoff: string): string {
  const normalized = `${pickup.toLowerCase()}-to-${dropoff.toLowerCase()}`
  
  // 簡單匹配邏輯
  if (normalized.includes('hong-kong') && normalized.includes('shanwei')) {
    if (normalized.indexOf('hong-kong') < normalized.indexOf('shanwei')) {
      return 'hong-kong-to-shanwei'
    } else {
      return 'shanwei-to-hong-kong'
    }
  }
  
  return 'default'
}
