import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * 紧急迁移 API - 添加 service_type 字段
 * POST /api/admin/run-migration
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    // 测试字段是否存在
    const { error: testError } = await supabaseAdmin
      .from('orders')
      .select('service_type')
      .limit(1)
    
    if (!testError) {
      return NextResponse.json({
        success: true,
        message: 'service_type 字段已存在，无需迁移',
        hasServiceType: true
      })
    }
    
    return NextResponse.json({
      success: false,
      message: 'service_type 字段不存在，需要执行迁移',
      hasServiceType: false,
      error: testError.message,
      migrationFile: 'supabase/migrations/20260919_add_service_type_simple.sql'
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: '请使用 POST 方法'
  })
}
