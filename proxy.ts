import { NextResponse, type NextRequest } from 'next/server'
import { rateLimit, getClientIp, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit'

/**
 * 全域 proxy（Next.js 16 從 middleware 改名而來）
 * 行為一致；只在 export 函式名稱上不同（Next 16 期望 default 或 "proxy"）。
 *
 * 作用：
 *   1. /admin/* 頁面與 /api/admin/* API：必須登入且 role=admin，否則重導/401
 *   2. /driver/* 頁面與 /api/driver/* API（POST/PATCH/DELETE）：必須登入且 role=driver
 *   3. /passenger/orders 等需登入頁面：必須登入（任意角色）
 *
 * 認證原理：
 *   Supabase Auth cookie 為 sb-<projectRef>-auth-token（chunked），
 *   cookie 中是 base64(JSON({ access_token, refresh_token, ... }))。
 *   為了 runtime 速度，這裡只解析 chunked cookie 並簡單檢查有 access_token，
 *   真正的 role / passenger_id 驗證留給 API route 內部的 getCurrentXxx() 處理。
 *   （middleware 只擋掉「完全沒登入」這個最常見的攻擊面；偽造 cookie 會在 API 層被擋）
 *
 * H6：把分散在各 route 的認證集中前置，減少遺漏。
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const PROJECT_REF = (() => {
  try {
    return SUPABASE_URL.split('//')[1]?.split('.')[0] ?? ''
  } catch {
    return ''
  }
})()
const COOKIE_BASE = PROJECT_REF ? `sb-${PROJECT_REF}-auth-token` : ''

function parseSessionFromCookie(cookieHeader: string | null): {
  access_token?: string
  role?: string
} | null {
  if (!cookieHeader || !COOKIE_BASE) return null

  // 收集 chunked cookie
  const chunks: string[] = []
  const cookies = cookieHeader.split(';')
  for (const c of cookies) {
    const [key, value] = c.trim().split('=')
    if (!key || !value) continue
    if (key === COOKIE_BASE) chunks[0] = decodeURIComponent(value)
    else if (key.startsWith(`${COOKIE_BASE}.`)) {
      const idx = Number(key.slice(COOKIE_BASE.length + 1))
      if (Number.isFinite(idx)) chunks[idx] = decodeURIComponent(value)
    }
  }
  const joined = chunks.filter(Boolean).join('')
  if (!joined) return null

  let tokenData: any
  try {
    tokenData = JSON.parse(joined)
  } catch {
    try {
      tokenData = JSON.parse(atob(joined))
    } catch {
      return null
    }
  }
  return { access_token: tokenData.access_token }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const cookieHeader = request.headers.get('cookie')
  const session = parseSessionFromCookie(cookieHeader)
  const loggedIn = !!session?.access_token

  // ---- Rate limiting：登入/註冊 ----
  if (pathname === '/api/auth/login' || pathname === '/api/auth/register') {
    const ip = getClientIp(request)
    const r = rateLimit(`auth:${ip}`, RATE_LIMITS.auth)
    if (!r.allowed) return rateLimitResponse(r.resetMs)
  }

  // ---- /admin/* 與 /api/admin/*：需登入 ----
  if (pathname.startsWith('/admin')) {
    if (!loggedIn) {
      const loginUrl = new URL('/passenger/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
    // 角色檢查交給頁面 layout 與 API 內部；middleware 沒解 JWT。
  }

  // ---- /api/admin/* ----
  if (pathname.startsWith('/api/admin')) {
    if (!loggedIn) {
      return NextResponse.json(
        { success: false, error: '需要管理員權限', code: 'ADMIN_REQUIRED' },
        { status: 401 }
      )
    }
  }

  // ---- /driver/*（頁面） ----
  if (pathname.startsWith('/driver') && !pathname.startsWith('/driver/login')) {
    if (!loggedIn) {
      const loginUrl = new URL('/driver/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // ---- /api/driver/*（POST/PATCH/DELETE/PUT）寫入操作：需登入 ----
  if (pathname.startsWith('/api/driver')) {
    const method = request.method
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !loggedIn) {
      return NextResponse.json(
        { success: false, error: '請先登入司機帳號', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }
  }

  // ---- /passenger/orders, /passenger/profile/*：需登入 ----
  if (
    pathname.startsWith('/passenger/orders') ||
    pathname.startsWith('/passenger/profile') ||
    pathname.startsWith('/passenger/track')
  ) {
    if (!loggedIn) {
      const loginUrl = new URL('/passenger/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

/**
 * 限定 middleware 只跑在前述路徑，靜態資源不會被掃。
 */
export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/driver/:path*',
    '/api/driver/:path*',
    '/api/auth/login',
    '/api/auth/register',
    '/passenger/orders/:path*',
    '/passenger/profile/:path*',
    '/passenger/track/:path*',
  ],
}
