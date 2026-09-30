import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  isValidHKPhone,
  isValidMainlandPhone,
  phoneToEmail,
  cleanPhone,
  isValidEmail,
  type Region
} from '@/lib/auth-utils'

/**
 * 通用註冊 API（乘客/司機）
 * POST /api/auth/register
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { method, password, name } = body

    // 角色永遠由伺服器端決定為 'passenger'。
    // 司機註冊必須走招募審核流程（/api/driver-recruit + 後台審核 + 新增司機帳號）。
    const userRole: 'passenger' = 'passenger'

    if (!password || !name || !method) {
      return NextResponse.json(
        { error: '缺少必填字段', message: '請填寫完整信息' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: '密碼太短', message: '密碼至少需要 6 個字符' },
        { status: 400 }
      )
    }

    let authEmail: string
    let phone: string | null = null
    let region: Region = 'hk'

    if (method === 'email') {
      const { email } = body
      if (!email) {
        return NextResponse.json(
          { error: '缺少電郵', message: '請輸入電郵地址' },
          { status: 400 }
        )
      }
      if (!isValidEmail(email)) {
        return NextResponse.json(
          { error: '電郵格式錯誤', message: '請輸入有效的電郵地址' },
          { status: 400 }
        )
      }
      authEmail = email.trim().toLowerCase()
    } else if (method === 'phone') {
      const { phone: inputPhone } = body
      region = (body.region === 'mainland' ? 'mainland' : 'hk') as Region

      if (!inputPhone) {
        return NextResponse.json(
          { error: '缺少電話', message: '請輸入手機號碼' },
          { status: 400 }
        )
      }

      const cleaned = cleanPhone(inputPhone)

      if (region === 'hk') {
        if (!isValidHKPhone(cleaned)) {
          return NextResponse.json(
            { error: '電話格式錯誤', message: '請輸入有效的香港手機號碼（8位數字，以5/6/7/8/9開頭）' },
            { status: 400 }
          )
        }
      } else {
        if (!isValidMainlandPhone(cleaned)) {
          return NextResponse.json(
            { error: '電話格式錯誤', message: '請輸入有效的內地手機號碼（11位數字，以1[3-9]開頭）' },
            { status: 400 }
          )
        }
      }

      phone = cleaned
      authEmail = phoneToEmail(phone, region)
    } else {
      return NextResponse.json(
        { error: '不支援的註冊方式', message: '請選擇電郵或手機號碼註冊' },
        { status: 400 }
      )
    }

    if (phone) {
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('phone', phone)
        .single()

      if (existingUser) {
        return NextResponse.json(
          { error: '電話已被使用', message: '此手機號碼已註冊，請直接登入' },
          { status: 409 }
        )
      }
    }

    const fullPhone = phone ? `${region === 'hk' ? '+852' : '+86'}${phone}` : null

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      phone: phone || undefined,
      user_metadata: {
        role: userRole,
        name,
        phone: phone || '',
        phone_region: region,
        full_phone: fullPhone || '',
        register_method: method
      }
    })

    if (error) {
      if (error.message.includes('already') || error.message.includes('exists')) {
        return NextResponse.json(
          { error: '已被使用', message: `此手機號碼已註冊，請直接登入` },
          { status: 409 }
        )
      }
      throw error
    }

    if (!data.user) {
      throw new Error('註冊失敗，未返回用戶信息')
    }

    const userId = data.user.id

    await new Promise(resolve => setTimeout(resolve, 600))

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('id', userId)
      .single()

    if (!profile) {
      let insertSuccess = false
      try {
        const { error: insertErr1 } = await supabaseAdmin
          .from('users')
          .insert({
            id: userId,
            role: userRole,
            phone: phone || '00000000',
            name,
            register_method: method
          })

        if (!insertErr1) {
          insertSuccess = true
        }
      } catch (e: any) {
        console.warn('[register] 插入異常:', e.message)
      }

      if (!insertSuccess) {
        const { error: insertErr2 } = await supabaseAdmin
          .from('users')
          .insert({
            id: userId,
            role: userRole,
            phone: phone || '00000000',
            name
          })

        if (insertErr2) {
          console.error('[register] 手動創建用戶記錄失敗:', insertErr2)
          throw new Error(`創建用戶記錄失敗：${insertErr2.message}`)
        }
      }
    } else if (phone) {
      await supabaseAdmin
        .from('users')
        .update({ phone })
        .eq('id', userId)
    }

    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: authEmail,
      password
    })

    if (signInError || !signInData.session) {
      console.error('Auto sign-in failed:', signInError)
      return NextResponse.json({
        success: true,
        message: '註冊成功！請登入',
        userId
      })
    }

    const response = NextResponse.json({
      success: true,
      message: method === 'phone'
        ? (region === 'hk' ? '香港手機號碼註冊成功！' : '內地手機號碼註冊成功！')
        : '電郵註冊成功！',
      user: {
        id: userId,
        email: method === 'email' ? authEmail : null,
        phone: phone,
        fullPhone: fullPhone,
        region: region,
        name,
        role: userRole,
        registerMethod: method
      }
    })

    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!.split('//')[1]?.split('.')[0]

    const sessionData = JSON.stringify({
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
      expires_at: signInData.session.expires_at,
      expires_in: signInData.session.expires_in,
      token_type: 'Bearer'
    })

    const CHUNK_SIZE = 4096
    const chunks: string[] = []
    for (let i = 0; i < sessionData.length; i += CHUNK_SIZE) {
      chunks.push(sessionData.slice(i, i + CHUNK_SIZE))
    }

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
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
    console.error('註冊失敗:', error)
    return NextResponse.json(
      {
        error: '註冊失敗',
        message: error.message || '未知錯誤'
      },
      { status: 500 }
    )
  }
}
