import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentAdmin } from '@/lib/auth-server'

/**
 * 更新司機招募申請狀態
 * PATCH /api/admin/applications/[id]
 * Body: { status: 'pending'|'reviewing'|'approved'|'rejected', reviewer_note?: string }
 *
 * 認證（H1）：必須登入且為 admin。
 */

const VALID_STATUSES = ['pending', 'reviewing', 'approved', 'rejected'] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin(request)
    if (!admin) {
      return NextResponse.json(
        { success: false, error: '需要管理員權限', code: 'ADMIN_REQUIRED' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const { status, reviewer_note } = body as { status?: string; reviewer_note?: string }

    if (!status || !VALID_STATUSES.includes(status as any)) {
      return NextResponse.json(
        { success: false, error: `狀態無效（需為 ${VALID_STATUSES.join(' / ')}）` },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ success: false, error: '伺服器配置錯誤' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const update: Record<string, any> = {
      status,
      reviewer_id: admin.id,
    }
    if (typeof reviewer_note === 'string') {
      update.reviewer_note = reviewer_note.trim() || null
    }
    if (status !== 'pending') {
      update.reviewed_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('driver_applications')
      .update(update)
      .eq('id', id)
      .select('id, status, reviewer_note, reviewed_at, phone, name, plate, car_type, driving_years')
      .single()

    if (error) {
      console.error('[admin/applications PATCH] error:', error)
      return NextResponse.json(
        { success: false, error: '更新失敗：' + error.message },
        { status: 500 }
      )
    }

    // 副作用：若 status 變為 approved，嘗試把對應電話的使用者升級為 driver
    // 並建立 driver_info。若使用者尚未註冊，回傳 result.userLinked=false 讓 admin UI 提示。
    let sideEffects: {
      userLinked: boolean
      driverInfoCreated: boolean
      message?: string
    } = { userLinked: false, driverInfoCreated: false }

    if (status === 'approved' && data) {
      const phoneRaw = (data as any).phone as string | undefined
      if (phoneRaw) {
        const cleanedPhone = phoneRaw.replace(/[\s+\-]/g, '')
        // 查詢對應 user（依 phone 比對；同時容忍帶 +852/+86 前綴）
        const { data: matchedUsers } = await supabase
          .from('users')
          .select('id, phone, role')
          .or(`phone.eq.${cleanedPhone},phone.eq.+852${cleanedPhone},phone.eq.+86${cleanedPhone}`)
          .limit(1)

        const matched = matchedUsers?.[0]
        if (matched) {
          // 1) 升級 role
          if (matched.role !== 'driver') {
            const { error: roleErr } = await supabase
              .from('users')
              .update({ role: 'driver' })
              .eq('id', matched.id)
            if (roleErr) {
              console.error('[admin/applications PATCH] upgrade role failed:', roleErr)
            } else {
              sideEffects.userLinked = true
            }
          } else {
            sideEffects.userLinked = true
          }

          // 2) 建 driver_info（若尚未存在）
          const { data: existingInfo } = await supabase
            .from('driver_info')
            .select('id')
            .eq('id', matched.id)
            .maybeSingle()

          if (!existingInfo) {
            const carTypeToVehicleType: Record<string, string> = {
              sedan_5: '5_seat',
              alphard_7: '7_seat',
              business_9: '9_seat',
            }
            const { error: infoErr } = await supabase.from('driver_info').insert({
              id: matched.id,
              vehicle_plate: (data as any).plate,
              vehicle_model: carTypeToVehicleType[(data as any).car_type] ?? (data as any).car_type,
              driving_years: (data as any).driving_years,
              rating: 5.0,
              total_orders: 0,
              total_rating_sum: 0,
              total_rating_count: 0,
              membership_tier: 'gold',
              status: 'offline',
            })
            if (infoErr) {
              console.error('[admin/applications PATCH] driver_info insert failed:', infoErr)
            } else {
              sideEffects.driverInfoCreated = true
            }
          }
        } else {
          sideEffects.message = '此電話尚未註冊帳號；使用者註冊後可手動補建'
        }
      }
    }

    return NextResponse.json({ success: true, application: data, sideEffects })
  } catch (err) {
    console.error('[admin/applications PATCH] unexpected:', err)
    return NextResponse.json({ success: false, error: '伺服器異常' }, { status: 500 })
  }
}
