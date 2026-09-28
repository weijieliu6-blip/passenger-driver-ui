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

    if (!profile || profile.role !== 'passenger') return null

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
