import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentDriver } from '@/lib/auth-server'

/**
 * 司機排程 API
 * GET  /api/driver/schedule            列出當前司機所有排程
 * POST /api/driver/schedule            新增排程
 */

const SUPABASE_URL = 'https://vuuamydahzhpajjdvokl.supabase.co'

function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function GET(request: NextRequest) {
  try {
    const driver = await getCurrentDriver(request)
    if (!driver || driver.role !== 'driver') {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = getAdminClient()
    const { data: schedules, error } = await supabaseAdmin
      .from('driver_schedules')
      .select('*')
      .eq('driver_id', driver.id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('查排程失敗:', error)
      return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      schedules: schedules || [],
      count: schedules?.length || 0,
    })
  } catch (error: any) {
    console.error('Get schedules failed:', error)
    return NextResponse.json(
      { error: '服務錯誤', message: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const driver = await getCurrentDriver(request)
    if (!driver || driver.role !== 'driver') {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { schedule_type, weekday, start_time, end_time, schedule_date } = body || {}

    if (!['recurring', 'oneoff'].includes(schedule_type)) {
      return NextResponse.json(
        { error: 'schedule_type 必須為 recurring 或 oneoff' },
        { status: 400 }
      )
    }

    if (!start_time || !end_time) {
      return NextResponse.json(
        { error: '缺少 start_time 或 end_time' },
        { status: 400 }
      )
    }

    const payload: Record<string, any> = {
      driver_id: driver.id,
      schedule_type,
      start_time,
      end_time,
    }

    if (schedule_type === 'recurring') {
      if (typeof weekday !== 'number' || weekday < 0 || weekday > 6) {
        return NextResponse.json(
          { error: 'recurring 必須提供 weekday (0-6)' },
          { status: 400 }
        )
      }
      payload.weekday = weekday
    } else if (schedule_type === 'oneoff') {
      if (!schedule_date) {
        return NextResponse.json(
          { error: 'oneoff 必須提供 schedule_date (YYYY-MM-DD)' },
          { status: 400 }
        )
      }
      payload.schedule_date = schedule_date
    }

    const supabaseAdmin = getAdminClient()
    const { data, error } = await supabaseAdmin
      .from('driver_schedules')
      .insert(payload)
      .select()
      .single()

    if (error) {
      console.error('新增排程失敗:', error)
      return NextResponse.json({ error: '新增失敗：' + error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      schedule: data,
    })
  } catch (error: any) {
    console.error('Create schedule failed:', error)
    return NextResponse.json(
      { error: '服務錯誤', message: error.message },
      { status: 500 }
    )
  }
}
