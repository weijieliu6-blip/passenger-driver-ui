/**
 * In-memory rate limiter（sliding window）
 *
 * 設計：
 *   - 用 Map<key, number[]> 存每個 key 最近的請求時間戳
 *   - 每次呼叫時剔除超過 windowMs 的舊紀錄
 *   - 若剩餘筆數 >= limit 則拒絕
 *
 * 限制（重要！）：
 *   - Vercel Edge / serverless 函數的 in-memory store 在跨實例時**不**共享，
 *     所以這僅作為「單實例」的輕度保護。對抗分散式爆破仍需依賴 Cloudflare /
 *     Upstash / Vercel Firewall 等外部 WAF。文件明確告知這一點。
 *   - Edge runtime 不支援 'server-only' 標記，因此本檔案須保持 edge-safe
 *     （不 import Node-only 套件）。
 *
 * 使用：
 *   - `rateLimit('login:'+ip, { limit: 5, windowMs: 60_000 })`
 *   - 回傳 `{ allowed: boolean, remaining: number, resetMs: number }`
 */

interface Bucket {
  timestamps: number[] // ms epoch
}

const buckets = new Map<string, Bucket>()

// 簡單週期性清理，避免 Map 無限成長
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000
let lastCleanup = Date.now()
function maybeCleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return
  lastCleanup = now
  for (const [key, bucket] of buckets.entries()) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < 10 * 60 * 1000)
    if (bucket.timestamps.length === 0) buckets.delete(key)
  }
}

export interface RateLimitOptions {
  /** 時間窗（毫秒） */
  windowMs: number
  /** 時間窗內最大請求數 */
  limit: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  /** 距離下一個 slot 釋出的毫秒數（>=0） */
  resetMs: number
}

export function rateLimit(
  key: string,
  opts: RateLimitOptions
): RateLimitResult {
  const now = Date.now()
  maybeCleanup(now)

  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { timestamps: [] }
    buckets.set(key, bucket)
  }

  // 滑動窗口：剔除 windowMs 以外的舊紀錄
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < opts.windowMs)

  if (bucket.timestamps.length >= opts.limit) {
    const oldest = bucket.timestamps[0]
    const resetMs = Math.max(0, opts.windowMs - (now - oldest))
    return { allowed: false, remaining: 0, resetMs }
  }

  bucket.timestamps.push(now)
  return {
    allowed: true,
    remaining: opts.limit - bucket.timestamps.length,
    resetMs: 0,
  }
}

/**
 * 從 Request 取出 best-effort client IP
 *   - x-forwarded-for 第一個（剝掉 client 之前 proxy 串接的）
 *   - x-real-ip
 *   - 退回 'unknown'
 */
export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const xri = request.headers.get('x-real-ip')
  if (xri) return xri
  return 'unknown'
}

/**
 * 預設 rate limit 設定（中央化，方便日後調整）
 */
export const RATE_LIMITS = {
  /** 登入 / 註冊：每 IP 5 req / 60s */
  auth: { limit: 5, windowMs: 60_000 },
  /** 訂單建立：每 user 1 req / 30s */
  orderCreate: { limit: 1, windowMs: 30_000 },
  /** 搶單：每 user 10 req / 60s（防止狂點） */
  grab: { limit: 10, windowMs: 60_000 },
  /** 位置回報：每 user 60 req / 60s（每 15s 一次 = 4/min，留餘裕） */
  location: { limit: 60, windowMs: 60_000 },
  /** 通用：每 IP 60 req / 60s */
  general: { limit: 60, windowMs: 60_000 },
} as const

/**
 * 輔助：包成 NextResponse（API route 用）
 */
export function rateLimitResponse(resetMs: number, prefix = 'Too many requests') {
  const seconds = Math.ceil(resetMs / 1000)
  return new Response(
    JSON.stringify({
      error: prefix,
      message: `請求太頻繁，請於 ${seconds} 秒後重試`,
      retryAfterSeconds: seconds,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(seconds),
      },
    }
  )
}
