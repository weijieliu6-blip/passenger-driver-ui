import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// 創建基於 cookie 的 server-side Supabase 客戶端
export function createServerClient(accessToken?: string, refreshToken?: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: accessToken ? {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    } : undefined
  })
}

// 從請求中解析 Supabase auth token
function parseAuthToken(request: Request): string | null {
  try {
    const cookieHeader = request.headers.get('cookie')
    if (!cookieHeader) return null
    
    const cookies: Record<string, string> = {}
    cookieHeader.split(';').forEach(cookie => {
      const [key, value] = cookie.trim().split('=')
      if (key && value) {
        cookies[key] = decodeURIComponent(value)
      }
    })
    
    const projectRef = supabaseUrl.split('//')[1]?.split('.')[0]
    const baseCookieName = `sb-${projectRef}-auth-token`
    
    let tokenCookie = cookies[baseCookieName]
    
    if (!tokenCookie || tokenCookie === '') {
      let chunkedSession = ''
      let chunkIndex = 0
      while (cookies[`${baseCookieName}.${chunkIndex}`]) {
        chunkedSession += cookies[`${baseCookieName}.${chunkIndex}`]
        chunkIndex++
      }
      if (chunkedSession) {
        tokenCookie = chunkedSession
      }
    }
    
    if (!tokenCookie) return null
    
    let tokenData: any
    try {
      tokenData = JSON.parse(tokenCookie)
    } catch {
      try {
        tokenData = JSON.parse(Buffer.from(tokenCookie, 'base64').toString())
      } catch {
        return null
      }
    }
    
    return tokenData.access_token || null
  } catch {
    return null
  }
}

export interface PassengerProfile {
  id: string
  email: string
  name: string
  phone: string
  role: 'passenger' | 'driver' | 'admin'
  avatar_url?: string
  createdAt: string
}

export interface DriverProfileAuth {
  id: string
  email: string
  name: string
  phone: string
  role: 'driver'
  vehicle_plate?: string
  vehicle_type?: string
  rating?: number
  membership_tier?: string
  createdAt: string
}

/**
 * 從請求 cookies 中獲取當前乘客信息
 */
export async function getCurrentPassenger(request: Request): Promise<PassengerProfile | null> {
  try {
    const accessToken = parseAuthToken(request)
    if (!accessToken) return null
    
    const supabase = createServerClient(accessToken)
    const { data: { user }, error } = await supabase.auth.getUser(accessToken)
    
    if (error || !user) return null
    
    const { data: profile } = await supabase
      .from('users')
      .select('id, role, phone, name, avatar_url, created_at')
      .eq('id', user.id)
      .single()

    // 若 auth user 已存在但 passenger profile 缺失，自動補建（向後相容舊帳號）
    if (!profile) {
      const autoCreate = await autoCreatePassengerProfile(supabase, user)
      if (!autoCreate) {
        console.warn('[auth-server] passenger profile missing and auto-create failed for', user.id)
        return null
      }
      return {
        id: autoCreate.id,
        email: user.email || '',
        name: autoCreate.name,
        phone: autoCreate.phone,
        avatar_url: autoCreate.avatar_url ?? undefined,
        role: autoCreate.role,
        createdAt: autoCreate.created_at,
      }
    }

    if (profile.role !== 'passenger') return null

    return {
      id: profile.id,
      email: user.email || '',
      name: profile.name,
      phone: profile.phone,
      avatar_url: profile.avatar_url,
      role: profile.role,
      createdAt: profile.created_at
    }
  } catch (error) {
    console.error('getCurrentPassenger error:', error)
    return null
  }
}

/**
 * 從請求 cookies 中獲取當前司機信息
 */
export async function getCurrentDriver(request: Request): Promise<DriverProfileAuth | null> {
  try {
    const accessToken = parseAuthToken(request)
    if (!accessToken) return null
    
    const supabase = createServerClient(accessToken)
    const { data: { user }, error } = await supabase.auth.getUser(accessToken)
    
    if (error || !user) return null
    
    // 獲取司機基本信息
    const { data: profile } = await supabase
      .from('users')
      .select('id, role, phone, name, created_at')
      .eq('id', user.id)
      .single()
    
    if (!profile || profile.role !== 'driver') return null
    
// Single source of truth: public.driver_info (id = users.id).
    const { data: driverInfo } = await supabase
      .from('driver_info')
      .select('vehicle_plate, vehicle_model, rating, membership_tier')
      .eq('id', user.id)
      .maybeSingle()

    return {
      id: profile.id,
      email: user.email || '',
      name: profile.name,
      phone: profile.phone,
      role: 'driver',
      vehicle_plate: driverInfo?.vehicle_plate,
      vehicle_type: driverInfo?.vehicle_model,
      rating: driverInfo?.rating,
      membership_tier: driverInfo?.membership_tier || 'gold',
      createdAt: profile.created_at
    }
  } catch (error) {
    console.error('getCurrentDriver error:', error)
    return null
  }
}

/**
 * 通用：獲取當前用戶（不限定角色）
 */
export async function getCurrentUser(request: Request): Promise<{
  id: string
  email: string
  name: string
  phone: string
  role: 'passenger' | 'driver' | 'admin'
} | null> {
  try {
    const accessToken = parseAuthToken(request)
    if (!accessToken) return null
    
    const supabase = createServerClient(accessToken)
    const { data: { user }, error } = await supabase.auth.getUser(accessToken)
    
    if (error || !user) return null
    
    const { data: profile } = await supabase
      .from('users')
      .select('id, role, phone, name')
      .eq('id', user.id)
      .single()
    
    if (!profile) return null

    return {
      id: profile.id,
      email: user.email || '',
      name: profile.name,
      phone: profile.phone,
      role: profile.role
    }
  } catch (error) {
    console.error('getCurrentUser error:', error)
    return null
  }
}

/**
 * 確認當前請求是否為 admin 角色。
 * 回傳：true / false（單純布林，不拋錯；呼叫端自行決定回 401 / 403）
 */
export async function isCurrentUserAdmin(request: Request): Promise<boolean> {
  const user = await getCurrentUser(request)
  return !!user && user.role === 'admin'
}

/**
 * 取當前 admin（若非 admin 回 null）
 */
export async function getCurrentAdmin(request: Request): Promise<{
  id: string
  email: string
  name: string
  phone: string
} | null> {
  const user = await getCurrentUser(request)
  if (!user || user.role !== 'admin') return null
  return { id: user.id, email: user.email, name: user.name, phone: user.phone }
}

/**
 * 為已存在的 Supabase auth user 自動補建 passenger profile。
 * 適用於舊帳號升級或 admin 角色誤登入前台等場景。
 * 需要 service role 才能寫入，失敗回傳 null。
 */
async function autoCreatePassengerProfile(
  userClient: ReturnType<typeof createServerClient>,
  user: { id: string; email?: string | null; phone?: string | null; user_metadata?: Record<string, any> }
): Promise<{ id: string; name: string; phone: string; avatar_url: string | null; role: 'passenger'; created_at: string } | null> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    console.error('[auth-server] SUPABASE_SERVICE_ROLE_KEY missing, cannot auto-create passenger profile')
    return null
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const meta = user.user_metadata || {}
  const name = (meta.name as string) || (user.email ? user.email.split('@')[0] : '乘客')
  const phone = (meta.phone as string) || (user.phone as string) || ''

  const { data: inserted, error } = await admin
    .from('users')
    .insert({
      id: user.id,
      role: 'passenger',
      phone,
      name,
    })
    .select('id, role, phone, name, avatar_url, created_at')
    .single()

  if (error || !inserted) {
    // 可能被並行請求先建好 → 再讀一次
    const { data: reread } = await userClient
      .from('users')
      .select('id, role, phone, name, avatar_url, created_at')
      .eq('id', user.id)
      .single()
    if (reread && reread.role === 'passenger') return reread
    console.error('[auth-server] auto-create passenger profile failed:', error?.message)
    return null
  }
  return inserted
}
