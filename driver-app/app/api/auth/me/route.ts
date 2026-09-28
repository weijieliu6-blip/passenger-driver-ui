import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-server'

/**
 * 獲取當前登入用戶信息（不限角色）
 * GET /api/auth/me
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)

    if (!user) {
      return NextResponse.json(
        { authenticated: false },
        { status: 200 }
      )
    }

    return NextResponse.json({
      authenticated: true,
      user
    })
  } catch (error: any) {
    console.error('Get current user failed:', error)
    return NextResponse.json(
      { authenticated: false, error: error.message },
      { status: 500 }
    )
  }
}
