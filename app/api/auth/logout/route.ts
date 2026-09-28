import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * 乘客登出 API
 * POST /api/auth/logout
 */
export async function POST(request: NextRequest) {
  try {
    // 登出 Supabase session
    await supabaseAdmin.auth.signOut()
    
    const response = NextResponse.json({
      success: true,
      message: '已登出'
    })
    
    // 清除所有 Supabase Auth cookies（包括分塊）
    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!.split('//')[1]?.split('.')[0]
    const cookieName = `sb-${projectRef}-auth-token`
    
    response.cookies.delete(cookieName)
    response.cookies.delete(`${cookieName}-code-verifier`)
    
    // 刪除可能的分塊 cookie (最多 5 個)
    for (let i = 0; i < 5; i++) {
      response.cookies.delete(`${cookieName}.${i}`)
    }
    
    return response
  } catch (error: any) {
    console.error('登出失敗:', error)
    return NextResponse.json(
      { error: '登出失敗', message: error.message },
      { status: 500 }
    )
  }
}
