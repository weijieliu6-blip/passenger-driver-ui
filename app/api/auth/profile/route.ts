import { NextRequest, NextResponse } from 'next/server'
import { getCurrentPassenger } from '@/lib/auth-server'
import { createServerClient } from '@/lib/auth-server'

/**
 * 更新乘客資料
 * PUT /api/auth/profile
 */
export async function PUT(request: NextRequest) {
  try {
    const passenger = await getCurrentPassenger(request)
    
    if (!passenger) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, phone } = body

    // 驗證必填項
    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: '姓名不能為空' },
        { status: 400 }
      )
    }

    if (!phone || !phone.trim()) {
      return NextResponse.json(
        { success: false, error: '電話不能為空' },
        { status: 400 }
      )
    }

    // 更新 public.users 表
    const supabase = createServerClient()
    const { error } = await supabase
      .from('users')
      .update({
        name: name.trim(),
        phone: phone.trim()
      })
      .eq('id', passenger.id)

    if (error) {
      console.error('Update profile error:', error)
      return NextResponse.json(
        { success: false, error: '更新失敗，請稍後重試' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '資料更新成功'
    })
  } catch (error: any) {
    console.error('Update profile failed:', error)
    return NextResponse.json(
      { success: false, error: error.message || '更新失敗' },
      { status: 500 }
    )
  }
}
