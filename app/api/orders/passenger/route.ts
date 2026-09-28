import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentPassenger } from '@/lib/auth-server'

const supabase = createClient(
  'https://vuuamydahzhpajjdvokl.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

/**
 * 查询乘客订单 API
 * GET /api/orders/passenger?phone=13800138000
 * 
 * 支持两种查询方式：
 * 1. 已登入乘客（透過 cookie） - 自動查詢所有自己的訂單
 * 2. 未登入（透過 ?phone=xxx） - 通過電話號碼查詢
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const phone = searchParams.get('phone')
    
    // 优先检查已登入乘客
    const currentPassenger = await getCurrentPassenger(request)
    
    if (currentPassenger) {
      // 已登入：查詢該乘客的所有訂單（透過 passenger_id 綁定）
      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .or(`passenger_id.eq.${currentPassenger.id},passenger_phone.eq.${currentPassenger.phone}`)
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
    }
    
    // 未登入：必須提供電話號碼
    if (!phone) {
      return NextResponse.json(
        { 
          error: '缺少参数', 
          message: '請輸入電話號碼查詢訂單，或先登入帳號',
          authenticated: false
        },
        { status: 400 }
      )
    }
    
    // 通过手机号查询
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('passenger_phone', phone)
      .order('created_at', { ascending: false })
    
    if (error) {
      throw error
    }
    
    return NextResponse.json({
      success: true,
      orders: orders || [],
      authenticated: false
    })
  } catch (error: any) {
    console.error('查询订单列表失败:', error)
    return NextResponse.json(
      { error: '查询订单列表失败', message: error.message },
      { status: 500 }
    )
  }
}
