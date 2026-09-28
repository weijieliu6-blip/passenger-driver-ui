import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * 登出 API
 * POST /api/auth/logout
 */
export async function POST(request: NextRequest) {
  try {
    await supabaseAdmin.auth.signOut()

    const response = NextResponse.json({
      success: true,
      message: '已登出'
    })

    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!.split('//')[1]?.split('.')[0]
    const cookieName = `sb-${projectRef}-auth-token`

    response.cookies.delete(cookieName)
    response.cookies.delete(`${cookieName}-code-verifier`)

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
