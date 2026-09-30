import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { pushOrderText } from '@/lib/dingtalk'
import { getCurrentPassenger } from '@/lib/auth-server'
import { rateLimit, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit'

/**
 * 创建订单 API
 * POST /api/orders/create
 */
export async function POST(request: NextRequest) {
  try {
    // 強制要求乘客必須登入才能下單（rate limit 前先驗身份，避免 IP 共享導致誤擋）
    const currentPassenger = await getCurrentPassenger(request)
    if (!currentPassenger) {
      return NextResponse.json(
        { error: '請先登入或註冊乘客帳號', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    // Rate limit：訂單建立。每 passenger 1 req / 30s（防 spam / 防 DoS）
    // 改為 per-user：避免公司 NAT、共享 WiFi 等多使用者共用 IP 時被誤擋
    const rl = rateLimit(`orderCreate:${currentPassenger.id}`, RATE_LIMITS.orderCreate)
    if (!rl.allowed) return rateLimitResponse(rl.resetMs)

    const body = await request.json()

    // 验证必填字段
    const requiredFields = [
      'direction',
      'pickupLocation',
      'dropoffLocation',
      'departureTime',
      'passengers',
      'vehicleType',
      'passengerPhone'
    ]

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `缺少必填字段: ${field}` },
          { status: 400 }
        )
      }
    }

    // 新欄位：詳細地址、座標、zone（向下相容：缺少時留 null）
    const pickupAddress = body.pickupAddress || null
    const dropoffAddress = body.dropoffAddress || null
    const pickupLat = typeof body.pickupLat === 'number' ? body.pickupLat : null
    const pickupLng = typeof body.pickupLng === 'number' ? body.pickupLng : null
    const dropoffLat = typeof body.dropoffLat === 'number' ? body.dropoffLat : null
    const dropoffLng = typeof body.dropoffLng === 'number' ? body.dropoffLng : null
    const pickupZoneCode = body.pickupZoneCode || null
    const dropoffZoneCode = body.dropoffZoneCode || null
    let estimatedFare = body.estimatedFare || null
    // 實際 pricing 計算移到 supabaseAdmin 宣告後

    // 驗證出發時間不能在過去（最少提前 30 分鐘）
    if (body.departureTime) {
      const depTime = new Date(body.departureTime)
      const now = new Date()
      const minLeadMs = 30 * 60 * 1000
      if (isNaN(depTime.getTime())) {
        return NextResponse.json({ error: '出發時間格式無效' }, { status: 400 })
      }
      if (depTime.getTime() < now.getTime() + minLeadMs) {
        return NextResponse.json(
          { error: '出發時間不能早於當前時間 30 分鐘' },
          { status: 400 }
        )
      }
    }

    // 转换 direction 字段（兼容新旧值）
    // 新值: hk_to_mainland | mainland_to_hk | sz_to_sw | sw_to_sz
    // 旧值（数据库枚举）: to_mainland | to_hk
    let dbDirection = body.direction
    if (body.direction === 'hk_to_mainland') {
      dbDirection = 'to_mainland'
    } else if (body.direction === 'mainland_to_hk') {
      dbDirection = 'to_hk'
    } else if (body.direction === 'sz_to_sw' || body.direction === 'sw_to_sz') {
      // 内地专车也归类为 to_mainland（用于跨境枚举兼容）
      dbDirection = 'to_mainland'
    }
    
    // 硬编码正确的 URL（临时修复环境变量缓存问题）
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    if (!supabaseUrl) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL 未設定')
    }

    console.log('🔍 使用 Supabase URL:', supabaseUrl)

    // 创建 Supabase 客户端
   const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 若前端沒帶 estimatedFare 且有 zone，後端自己用 RPC 算
    if (estimatedFare == null && pickupZoneCode && dropoffZoneCode) {
      try {
        const { data: priceData } = await supabaseAdmin.rpc('get_pricing_estimate', {
          p_pickup_zone: pickupZoneCode,
          p_dropoff_zone: dropoffZoneCode,
          p_vehicle_type: body.vehicleType,
          p_departure_time: body.departureTime || null,
        })
        if (priceData?.found) {
          estimatedFare = Number(priceData.total_price)
        }
      } catch (e) {
        console.warn('[orders/create] pricing RPC failed, fallback to null:', e)
      }
    }
    
    // 调用 generate_order_number RPC
    const orderNumberRes = await fetch(`${supabaseUrl}/rest/v1/rpc/generate_order_number`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Prefer': 'return=representation'
      }
    })    
    if (!orderNumberRes.ok) {
      const errorText = await orderNumberRes.text()
      throw new Error(`生成订单号失败: ${orderNumberRes.status} ${errorText}`)
    }
    
    const orderNumber = (await orderNumberRes.json()) as string
    
    // 调用 generate_grab_token RPC
    const grabTokenRes = await fetch(`${supabaseUrl}/rest/v1/rpc/generate_grab_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Prefer': 'return=representation'
      }
    })
    
    if (!grabTokenRes.ok) {
      const errorText = await grabTokenRes.text()
      throw new Error(`生成抢单 token 失败: ${grabTokenRes.status} ${errorText}`)
    }
    
    const grabToken = (await grabTokenRes.json()) as string
    
    // 计算 token 过期时间（24小时后）
    const tokenExpiresAt = new Date()
    tokenExpiresAt.setHours(tokenExpiresAt.getHours() + 24)

    // 司機接單 deadline（now + 24h）—— 用於前端等待時間卡的倒數
    const dispatchDeadlineAt = new Date()
    dispatchDeadlineAt.setHours(dispatchDeadlineAt.getHours() + 24)

    // 插入订单数据（含重试：race condition 导致 order_number 衝突时重新取号）
    // 部署時跑 advisory lock migration（supabase/migrations/20260930_order_number_advisory_lock.sql）
    // 可以從根本上避免衝突；應用層 retry 仍是必要的安全網（防禦性）。
    const MAX_INSERT_RETRIES = 10
    let order = null
    let lastInsertError = null
    for (let attempt = 0; attempt < MAX_INSERT_RETRIES; attempt++) {
      // 第 1 次使用已取的 orderNumber；後續每次重取
      let currentOrderNumber = orderNumber
      let currentGrabToken = grabToken
      if (attempt > 0) {
        const retryOrderNumberRes = await fetch(`${supabaseUrl}/rest/v1/rpc/generate_order_number`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Prefer': 'return=representation',
          },
        })
        const retryGrabTokenRes = await fetch(`${supabaseUrl}/rest/v1/rpc/generate_grab_token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Prefer': 'return=representation',
          },
        })
        if (!retryOrderNumberRes.ok || !retryGrabTokenRes.ok) {
          throw new Error(`生成訂單號/token 失敗 (retry ${attempt})`)
        }
        currentOrderNumber = (await retryOrderNumberRes.json()) as string
        currentGrabToken = (await retryGrabTokenRes.json()) as string
        // 指數退避 + 隨機抖動，避免 retry storm
        await new Promise(r => setTimeout(r, 80 + attempt * 80 + Math.floor(Math.random() * 80)))
      }

      const res = await supabaseAdmin
        .from('orders')
        .insert({
          order_number: currentOrderNumber,
          grab_token: currentGrabToken,
          grab_token_expires_at: tokenExpiresAt.toISOString(),
          dispatch_deadline_at: dispatchDeadlineAt.toISOString(),
          direction: dbDirection,
          pickup_location: body.pickupLocation,
          pickup_area: body.pickupArea || null,
          pickup_address: pickupAddress,
          pickup_lat: pickupLat,
          pickup_lng: pickupLng,
          dropoff_location: body.dropoffLocation,
          dropoff_area: body.dropoffArea || null,
          dropoff_address: dropoffAddress,
          dropoff_lat: dropoffLat,
          dropoff_lng: dropoffLng,
          pickup_zone: pickupZoneCode,
          dropoff_zone: dropoffZoneCode,
          departure_time: body.departureTime,
          passengers: body.passengers,
          luggage: body.luggage || 0,
          vehicle_type: body.vehicleType,
          is_charter: body.isCharter || false,
          has_child: body.hasChild || false,
          child_type: body.childType || null,
          passenger_name: currentPassenger.name,
          passenger_phone: currentPassenger.phone,
          passenger_notes: body.passengerNotes || null,
          passenger_id: currentPassenger.id,
          estimated_fare: estimatedFare,
          status: 'pending',
          gold_released_at: new Date().toISOString(),
          platinum_released_at: new Date(Date.now() + 60 * 1000).toISOString(),
          normal_released_at: new Date(Date.now() + 120 * 1000).toISOString(),
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          dingtalk_pushed: false,
        })
        .select()
        .single()

      if (!res.error) {
        order = res.data
        break
      }

      lastInsertError = res.error
      // 只有「唯一約束衝突」才重試；其他錯誤直接失敗
      const isUniqueViolation = res.error.code === '23505' || /duplicate key/i.test(res.error.message || '')
      if (!isUniqueViolation) {
        throw new Error('创建订单失败: ' + res.error.message)
      }
      console.warn(`[orders/create] insert 重試 ${attempt + 1}/${MAX_INSERT_RETRIES}，原因: ${res.error.message}`)
    }

    if (!order) {
      throw new Error('创建订单失败（重试 ' + MAX_INSERT_RETRIES + ' 次后仍衝突）: ' + (lastInsertError?.message ?? 'unknown'))
    }
    
    console.log('✅ 订单创建成功:', order.order_number)

    // 推送到钉钉群（純文字訊息，含搶單連結 URL）
    try {
      const notificationResult = await pushOrderText({
        orderNumber: order.order_number,
        grabToken: order.grab_token,
        direction: body.direction,
        pickup: order.pickup_location,
        dropoff: order.dropoff_location,
        pickupTime: body.departureTime,
        carType: order.vehicle_type,
        passengers: order.passengers,
        luggage: order.luggage,
        passengerName: order.passenger_name ?? '乘客',
        passengerPhone: order.passenger_phone,
        estimatedFare: body.estimatedFare ?? null,
        remark: order.passenger_notes ?? '',
        testMode: body.testMode === true,
      } as any)

      if (notificationResult.success) {
        console.log('✅ 钉钉纯文字推送成功:', order.order_number)
        // 記錄推送時間
        await supabaseAdmin
          .from('orders')
          .update({ dingtalk_pushed_at: new Date().toISOString() })
          .eq('id', order.id)
      } else {
        console.warn('⚠️ 钉钉推送失败，但订单已创建:', notificationResult.error)
      }
    } catch (pushError) {
      console.error('钉钉推送错误:', pushError)
      // 推送失败不影响订单创建
    }
    
    // 返回订单信息
    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        grabToken: order.grab_token,
        grabTokenExpiresAt: order.grab_token_expires_at,
        createdAt: order.created_at,
        // 同步回傳詳細欄位（讓前端可立即顯示，不需再 GET）
        estimatedFare: order.estimated_fare,
        pickupZone: order.pickup_zone,
        pickupAddress: order.pickup_address,
        pickupLat: order.pickup_lat,
        pickupLng: order.pickup_lng,
        dropoffZone: order.dropoff_zone,
        dropoffAddress: order.dropoff_address,
        dropoffLat: order.dropoff_lat,
        dropoffLng: order.dropoff_lng,
      }
    })
    
  } catch (error) {
    console.error('创建订单失败:', error)
    console.error('🔍 当前 SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    
    return NextResponse.json(
      { 
        error: '创建订单失败',
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

/**
 * 获取订单列表（可选功能）
 * GET /api/orders/create?phone=13800138000
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const phone = searchParams.get('phone')
    
    if (!phone) {
      return NextResponse.json(
        { error: '缺少手机号参数' },
        { status: 400 }
      )
    }
    
    // 硬编码正确的 URL（临时修复环境变量缓存问题）
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    if (!supabaseUrl) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL 未設定')
    }
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    // 查询该手机号的所有订单
    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('passenger_phone', phone)
      .order('created_at', { ascending: false })
      .limit(20)
    
    if (error) {
      throw new Error('查询订单失败: ' + error.message)
    }
    
    return NextResponse.json({
      success: true,
      orders: orders || []
    })
    
  } catch (error) {
    console.error('查询订单失败:', error)
    
    return NextResponse.json(
      { 
        error: '查询订单失败',
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}
