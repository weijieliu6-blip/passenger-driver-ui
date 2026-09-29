'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface UseDriverLocationOptions {
  /** 是否啟用上報；false 時 hook 不做任何事 */
  enabled: boolean
  /** 綁定到哪筆訂單（可為 null = 司機空閒中，不綁定） */
  orderNumber?: string | null
  /** 上報間隔（ms），預設 15000（15 秒） */
  intervalMs?: number
  /** 是否使用高精度定位（GPS），預設 true */
  enableHighAccuracy?: boolean
  /** 額外 payload */
  extra?: Record<string, unknown>
}

interface UseDriverLocationReturn {
  /** 目前最新位置 */
  location: GeolocationPosition['coords'] | null
  /** 最後錯誤（權限拒絕/未支援/網路失敗…） */
  error: string | null
  /** 上報成功次數 */
  sentCount: number
  /** 最後一次成功上報時間 */
  lastSentAt: number | null
  /** 是否正在 watch（追蹤中） */
  isWatching: boolean
  /** 手動觸發一次上報 */
  flushNow: () => void
}

/**
 * 司機端定位上報 hook
 * - 透過 navigator.geolocation.watchPosition 持續追蹤
 * - 每 intervalMs 將最新位置 POST 到 /api/driver/location
 * - 瀏覽器 tab 隱藏時自動暫停（節省電量）
 * - cleanup 時呼叫 navigator.geolocation.clearWatch
 */
export function useDriverLocation(
  opts: UseDriverLocationOptions
): UseDriverLocationReturn {
  const { enabled, orderNumber, intervalMs = 15000, enableHighAccuracy = true } = opts

  const [location, setLocation] = useState<GeolocationPosition['coords'] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sentCount, setSentCount] = useState(0)
  const [lastSentAt, setLastSentAt] = useState<number | null>(null)
  const [isWatching, setIsWatching] = useState(false)

  const watchIdRef = useRef<number | null>(null)
  const lastCoordsRef = useRef<GeolocationPosition['coords'] | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const orderRef = useRef<string | null | undefined>(orderNumber)

  // 讓上報永遠看到最新的 orderNumber
  useEffect(() => {
    orderRef.current = orderNumber
  }, [orderNumber])

  const sendOnce = useCallback(async () => {
    const coords = lastCoordsRef.current
    if (!coords) return
    try {
      const res = await fetch('/api/driver/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: coords.latitude,
          lng: coords.longitude,
          heading: coords.heading,
          speed: coords.speed,
          accuracy: coords.accuracy,
          order_number: orderRef.current ?? null,
        }),
        keepalive: true,
      })
      if (res.ok) {
        setSentCount((c) => c + 1)
        setLastSentAt(Date.now())
      } else {
        const text = await res.text().catch(() => '')
        setError(`上報失敗 (${res.status}): ${text}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '上報錯誤')
    }
  }, [])

  const flushNow = useCallback(() => {
    void sendOnce()
  }, [sendOnce])

  useEffect(() => {
    if (!enabled) return
    if (typeof window === 'undefined') return
    if (!('geolocation' in navigator)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('瀏覽器不支援 Geolocation API')
      return
    }

    // 同步外部系統狀態 → React state；屬合理使用 effect
    setError(null)
    setIsWatching(true)

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        lastCoordsRef.current = pos.coords
        setLocation(pos.coords)
      },
      (err) => {
        setError(`定位錯誤 (${err.code}): ${err.message}`)
      },
      {
        enableHighAccuracy,
        maximumAge: 5000,
        timeout: 30000,
      }
    )

    intervalRef.current = setInterval(() => {
      // 隱藏 tab 時不上報（節流）
      if (typeof document !== 'undefined' && document.hidden) return
      void sendOnce()
    }, intervalMs)

    // 立即先送一次
    void sendOnce()

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setIsWatching(false)
    }
  }, [enabled, enableHighAccuracy, intervalMs, sendOnce])

  return { location, error, sentCount, lastSentAt, isWatching, flushNow }
}