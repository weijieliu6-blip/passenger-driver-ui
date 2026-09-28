import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { pushOrderText } from '@/lib/dingtalk'
import { getCurrentPassenger } from '@/lib/auth-server'

/**
 * 创建订单 API
 * POST /api/orders/create
 */
export async function POST(request: NextRequest) {
  try {
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
    const supabaseUrl = 'https://vuuamydahzhpajjdvokl.supabase.co'
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    console.log('🔍 使用 Supabase URL:', supabaseUrl)
    
    // 尝试获取当前登入乘客（可选，未登入也能下单）
    const currentPassenger = await getCurrentPassenger(request)
    
    // 创建 Supabase 客户端
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
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

    // 插入订单数据
    const { data: order, error: insertError } = await supabaseAdmin
      .from('orders')
      .insert({
        order_number: orderNumber,
        grab_token: grabToken,
        grab_token_expires_at: tokenExpiresAt.toISOString(),
        dispatch_deadline_at: dispatchDeadlineAt.toISOString(),
        direction: dbDirection,
        pickup_location: body.pickupLocation,
        pickup_area: body.pickupArea || null,
        dropoff_location: body.dropoffLocation,
        dropoff_area: body.dropoffArea || null,
        departure_time: body.departureTime,
        passengers: body.passengers,
        luggage: body.luggage || 0,
        vehicle_type: body.vehicleType,
        is_charter: body.isCharter || false,
        has_child: body.hasChild || false,
        child_type: body.childType || null,
        passenger_name: body.passengerName || null,
        passenger_phone: body.passengerPhone,
        passenger_notes: body.passengerNotes || null,
        passenger_id: currentPassenger?.id || null,
        // 預估車資（取中間值）
        estimated_fare: body.estimatedFare || null,
        status: 'pending',
        // 分級推送時間戳：黃金即時 / 白金 +60s / 普通 +120s
        gold_released_at: new Date().toISOString(),
        platinum_released_at: new Date(Date.now() + 60 * 1000).toISOString(),
        normal_released_at: new Date(Date.now() + 120 * 1000).toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        dingtalk_pushed: false
      })
      .select()
      .single()
    
    if (insertError) {
      throw new Error('创建订单失败: ' + insertError.message)
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
      })

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
        createdAt: order.created_at
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
    const supabaseUrl = 'https://vuuamydahzhpajjdvokl.supabase.co'
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
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
