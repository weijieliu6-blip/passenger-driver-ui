import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * 司機招募申請 — POST /api/driver-recruit
 * Body: { name, phone, email?, plate, carType, drivingYears, city?, hasCrossBorderPermit, message? }
 *
 * 流程：
 * 1) 寫入 driver_applications 表（status=pending）
 * 2) 回傳申請編號 + ETA 24h
 *
 * 安全：表 RLS 允許 anon INSERT，所有資料會由後台人工審核
 */

interface ApplicationPayload {
  name?: string
  phone?: string
  email?: string
  plate?: string
  carType?: 'sedan_5' | 'alphard_7' | 'business_9'
  drivingYears?: number
  city?: string
  hasCrossBorderPermit?: boolean
  message?: string
}

function bad(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

const VALID_CAR_TYPES = ['sedan_5', 'alphard_7', 'business_9']

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as ApplicationPayload

    // 1) 必填驗證
    const name = String(body.name ?? '').trim()
    const phone = String(body.phone ?? '').trim()
    const plate = String(body.plate ?? '').trim()
    const carType = body.carType as string
    const drivingYears = Number(body.drivingYears ?? 0)
    const email = String(body.email ?? '').trim() || null

    if (!name) return bad('請填寫姓名')
    if (!phone) return bad('請填寫電話')
    if (!plate) return bad('請填寫車牌')
    if (!VALID_CAR_TYPES.includes(carType)) return bad('車型無效')
    if (!Number.isInteger(drivingYears) || drivingYears < 3 || drivingYears > 50) {
      return bad('駕齡需介於 3-50 年之間')
    }

    // 2) 電話格式驗證
    const phoneClean = phone.replace(/[\s-+]/g, '')
    const isPhoneValid = /^(\+?852\d{8}|\+?861[3-9]\d{9}|852\d{8}|1[3-9]\d{9})$/.test(phoneClean)
    if (!isPhoneValid) return bad('電話格式不正確（需 +852 港號或 +86 內地號）')

    // 3) Email 格式（若有填）
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return bad('Email 格式不正確')
    }

    // 4) 用 service role 寫入（繞過 RLS）
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      console.error('缺少 Supabase env vars')
      return bad('伺服器配置錯誤，請稍後重試', 500)
    }
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data, error: insertErr } = await adminClient
      .from('driver_applications')
      .insert({
        name,
        phone,
        email,
        plate,
        car_type: carType,
        driving_years: drivingYears,
        city: String(body.city ?? '').trim() || null,
        has_cross_border_permit: body.hasCrossBorderPermit === true,
        message: String(body.message ?? '').trim() || null,
        status: 'pending',
      })
      .select('id, created_at')
      .single()

    if (insertErr) {
      console.error('[driver-recruit] insert error:', insertErr)
      return bad('提交失敗，請稍後重試', 500)
    }

    console.log(`✅ 司機招募申請已收到 [${data.id}] ${name} (${phone}) — 駕齡 ${drivingYears}年`)

    return NextResponse.json({
      success: true,
      applicationId: data.id,
      message: '申請已收到！我們將於 24 小時內聯繫您。',
    })
  } catch (err) {
    console.error('[driver-recruit] unexpected:', err)
    return bad('伺服器異常', 500)
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'POST /api/driver-recruit',
    description: '司機招募申請 - 提交基本資料供後台審核',
    examplePayload: {
      name: '陳先生',
      phone: '+852 9123 4567',
      plate: 'HK 1234',
      carType: 'alphard_7',
      drivingYears: 8,
      email: 'optional@example.com',
      city: '香港',
      hasCrossBorderPermit: true,
      message: '可出車時段 9-21 / 粵語 / 普通話',
    },
  })
}
