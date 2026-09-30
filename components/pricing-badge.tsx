'use client'

import { useState, useEffect } from 'react'
import { Coins, Loader2, AlertCircle } from 'lucide-react'

interface Props {
  pickupZoneCode: string | null
  dropoffZoneCode: string | null
  vehicleType: string
  departureTime?: string | null
  className?: string
}

interface Estimate {
  found: boolean
  base_price?: number
  night_surcharge?: number
  total_price?: number
  currency?: string
  estimated_minutes?: number
  notes?: string
  message?: string
}

/**
 * 預估價格徽章
 * 自動根據 pickup/dropoff zone + vehicle_type + departure_time 查詢 RPC
 */
export default function PricingBadge({
  pickupZoneCode,
  dropoffZoneCode,
  vehicleType,
  departureTime,
  className,
}: Props) {
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!pickupZoneCode || !dropoffZoneCode || !vehicleType) {
      setEstimate(null)
      return
    }
    let cancelled = false
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/pricing/estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pickup_zone_code: pickupZoneCode,
            dropoff_zone_code: dropoffZoneCode,
            vehicle_type: vehicleType,
            departure_time: departureTime || null,
          }),
        })
        const data = await res.json()
        if (!cancelled) setEstimate(data)
      } catch (e) {
        console.error('[PricingBadge] error:', e)
        if (!cancelled) setEstimate({ found: false, message: '查詢失敗' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 300) // debounce
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [pickupZoneCode, dropoffZoneCode, vehicleType, departureTime])

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-sm text-slate-400 ${className || ''}`}>
        <Loader2 className="w-4 h-4 animate-spin" />
        估算價格中...
      </div>
    )
  }

  if (!estimate) return null

  if (!estimate.found) {
    return (
      <div className={`flex items-center gap-2 text-sm text-amber-400 ${className || ''}`}>
        <AlertCircle className="w-4 h-4" />
        {estimate.message || '此路線暫無標準報價，司機將自行報價'}
      </div>
    )
  }

  return (
    <div className={`rounded-lg border border-cyan-700/30 bg-cyan-900/10 p-3 ${className || ''}`}>
      <div className="flex items-center gap-2 mb-1">
        <Coins className="w-4 h-4 text-cyan-400" />
        <span className="text-xs text-slate-400">預估車資</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-cyan-300">
          {estimate.currency || 'HKD'} ${estimate.total_price}
        </span>
        {estimate.night_surcharge && estimate.night_surcharge > 0 ? (
          <span className="text-xs text-amber-400">含夜間加成 +${estimate.night_surcharge}</span>
        ) : null}
      </div>
      <div className="text-xs text-slate-500 mt-1 space-y-0.5">
        {estimate.estimated_minutes ? (
          <div>預估車程：{estimate.estimated_minutes} 分鐘</div>
        ) : null}
        {estimate.notes ? <div>{estimate.notes}</div> : null}
        <div className="text-slate-600">* 最終車資由司機報價確認</div>
      </div>
    </div>
  )
}