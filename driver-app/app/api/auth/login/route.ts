import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  detectInputType,
  parsePhone,
  phoneToEmail,
  type Region
} from '@/lib/auth-utils'

/**
 * 通用登入 API（乘客/司機）
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

    const inputType = detectInputType(identifier)

    let authEmail: string
    let region: Region = 'hk'
    let phone: string | null = null

    if (inputType === 'email') {
      authEmail = identifier.trim().toLowerCase()
    } else {
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

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('id, role, phone, name, vehicle_plate')
      .eq('id', data.user.id)
      .single()

    if (!profile) {
      return NextResponse.json(
        { error: '用戶資料不存在', message: '請聯繫客服' },
        { status: 404 }
      )
    }

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
        vehicle_plate: profile.vehicle_plate,
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
