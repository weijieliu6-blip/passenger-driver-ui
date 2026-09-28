import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { 
  detectInputType, 
  parsePhone, 
  phoneToEmail, 
  cleanPhone,
  type Region 
} from '@/lib/auth-utils'

/**
 * 乘客登入 API
 * 支持多種登入方式：
 * 1. 電郵：{ identifier: 'email@xxx.com', password }
 * 2. 香港手機號（純號碼）：{ identifier: '91234567', password }
 * 3. 內地手機號（純號碼）：{ identifier: '13800138000', password }
 * 4. 帶 +852/+86 前綴：{ identifier: '+85291234567' 或 '+8613800138000', password }
 *
 * POST /api/auth/login
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { identifier, password } = body
    
    if (!identifier || !password) {
      return NextResponse.json(
        { error: '缺少必填字段', message: '請輸入電郵/電話和密碼' },
        { status: 400 }
      )
    }
    
    // 自動判斷輸入類型
    const inputType = detectInputType(identifier)
    
    let authEmail: string
    let region: Region = 'hk'
    let phone: string | null = null
    
    if (inputType === 'email') {
      authEmail = identifier.trim().toLowerCase()
    } else {
      // 電話登入 - 解析地區
      const phoneInfo = parsePhone(identifier)
      
      if (!phoneInfo) {
        return NextResponse.json(
          { error: '電話格式錯誤', message: '請輸入有效的電郵、香港手機號（8位）或內地手機號（11位）' },
          { status: 400 }
        )
      }
      
      region = phoneInfo.region
      phone = phoneInfo.localNumber
      authEmail = phoneToEmail(phone, region)
    }
    
    // 登入
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email: authEmail,
      password
    })
    
    if (error || !data.session || !data.user) {
      const errorMsg = inputType === 'phone' 
        ? (region === 'hk' ? '香港手機號或密碼錯誤' : '內地手機號或密碼錯誤')
        : '電郵或密碼錯誤'
      return NextResponse.json(
        { 
          error: '登入失敗', 
          message: errorMsg
        },
        { status: 401 }
      )
    }
    
    // 獲取乘客 profile
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('id, role, phone, name')
      .eq('id', data.user.id)
      .single()
    
    if (!profile) {
      return NextResponse.json(
        { error: '用戶資料不存在', message: '請聯繫客服' },
        { status: 404 }
      )
    }
    
    // 設置 cookies
    const response = NextResponse.json({
      success: true,
      message: '登入成功',
      user: {
        id: profile.id,
        email: inputType === 'email' ? authEmail : null,
        phone: profile.phone,
        region: inputType === 'phone' ? region : null,
        name: profile.name,
        role: profile.role,
        registerMethod: inputType
      }
    })
    
    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!.split('//')[1]?.split('.')[0]
    
    const sessionData = JSON.stringify({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      expires_in: data.session.expires_in,
      token_type: 'Bearer'
    })
    
    const CHUNK_SIZE = 4096
    const chunks: string[] = []
    for (let i = 0; i < sessionData.length; i += CHUNK_SIZE) {
      chunks.push(sessionData.slice(i, i + CHUNK_SIZE))
    }
    
    const cookieOptions = {
      httpOnly: true,
      secure: false,
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    }
    
    if (chunks.length === 1) {
      response.cookies.set(`sb-${projectRef}-auth-token`, chunks[0], cookieOptions)
    } else {
      response.cookies.set(`sb-${projectRef}-auth-token`, '', cookieOptions)
      chunks.forEach((chunk, i) => {
        response.cookies.set(`sb-${projectRef}-auth-token.${i}`, chunk, cookieOptions)
      })
    }
    
    return response
    
  } catch (error: any) {
    console.error('登入失敗:', error)
    return NextResponse.json(
      { 
        error: '登入失敗',
        message: error.message || '未知錯誤'
      },
      { status: 500 }
    )
  }
}
