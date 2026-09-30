import 'server-only'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

/**
 * RSC-safe 認證輔助（與 lib/auth-server.ts 對應，但使用 next/headers 取得 cookie）
 *
 * 使用情境：
 *   - Server Component / Page / Layout（不能傳入 request）
 *   - 需要同步讀取當前用戶資料並 redirect 沒有權限者
 *
 * 注意：page/layout 用此函式時必須 `export const dynamic = 'force-dynamic'`
 *       以避免 build 時快取（否則 cookie 不會被讀到）。
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export interface SSRAuthUser {
  id: string
  email: string
  name: string
  phone: string
  role: 'passenger' | 'driver' | 'admin'
}

/**
 * 從 next/headers cookies() 解析 Supabase auth session
 * 並呼叫 users 表查出 role。
 */
export async function getSSRUser(): Promise<SSRAuthUser | null> {
  try {
    const cookieStore = await cookies()
    const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] ?? ''
    const baseCookieName = `sb-${projectRef}-auth-token`

    // 收集 chunked cookie
    const chunks: string[] = []
    const baseValue = cookieStore.get(baseCookieName)?.value
    if (baseValue) chunks[0] = baseValue
    let i = 0
    while (true) {
      const c = cookieStore.get(`${baseCookieName}.${i}`)?.value
      if (!c) break
      chunks[i] = c
      i++
    }
    const joined = chunks.filter(Boolean).join('')
    if (!joined) return null

    let session: any
    try {
      session = JSON.parse(joined)
    } catch {
      try {
        session = JSON.parse(Buffer.from(joined, 'base64').toString('utf-8'))
      } catch {
        return null
      }
    }

    const accessToken = session?.access_token
    if (!accessToken) return null

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    })

    const { data: { user }, error: userErr } = await supabase.auth.getUser(accessToken)
    if (userErr || !user) return null

    const { data: profile } = await supabase
      .from('users')
      .select('id, role, phone, name')
      .eq('id', user.id)
      .single()

    if (!profile) return null

    return {
      id: profile.id,
      email: user.email ?? '',
      name: profile.name,
      phone: profile.phone,
      role: profile.role,
    }
  } catch (err) {
    console.error('[getSSRUser] error:', err)
    return null
  }
}

/**
 * 確保當前 SSR 用戶是 admin，否則 redirect 到 /passenger/login
 */
export async function requireSSRAdmin(redirectTo?: string): Promise<SSRAuthUser> {
  const user = await getSSRUser()
  if (!user || user.role !== 'admin') {
    const url = `/passenger/login?redirect=${encodeURIComponent(redirectTo ?? '/admin/orders')}`
    redirect(url)
  }
  return user
}

/**
 * 確保當前 SSR 用戶已登入（任意角色）
 */
export async function requireSSRLogin(redirectTo?: string): Promise<SSRAuthUser> {
  const user = await getSSRUser()
  if (!user) {
    const url = `/passenger/login?redirect=${encodeURIComponent(redirectTo ?? '/')}`
    redirect(url)
  }
  return user
}

/**
 * 確保當前 SSR 用戶是 driver
 */
export async function requireSSRDriver(redirectTo?: string): Promise<SSRAuthUser> {
  const user = await getSSRUser()
  if (!user || user.role !== 'driver') {
    const url = `/driver/login?redirect=${encodeURIComponent(redirectTo ?? '/driver/dashboard')}`
    redirect(url)
  }
  return user
}
