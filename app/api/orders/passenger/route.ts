import { NextRequest, NextResponse } from 'next/server'
import { getCurrentPassenger } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * 查詢乘客訂單列表 API
 * GET /api/orders/passenger
 *
 * 認證：必須登入；透過 passenger_id 取得自己所有訂單。
 * （原本支援 ?phone= 的 fallback 已被移除——任何人都能用電話查他人訂單，
 *   屬於 PII 漏洞。乘客只能查自己的訂單。）
 */
export async function GET(request: NextRequest) {
  try {
    const currentPassenger = await getCurrentPassenger(request)

    if (!currentPassenger) {
      return NextResponse.json(
        {
          error: '請先登入',
          message: '請先登入乘客帳號以查看訂單',
          authenticated: false
        },
        { status: 401 }
      )
    }

    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('passenger_id', currentPassenger.id)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      orders: orders || [],
      authenticated: true,
      user: {
        id: currentPassenger.id,
        name: currentPassenger.name,
        phone: currentPassenger.phone
      }
    })
  } catch (error: any) {
    console.error('查询订单列表失败:', error)
    return NextResponse.json(
      { error: '查询订单列表失败', message: error.message },
      { status: 500 }
    )
  }
}
