import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://vuuamydahzhpajjdvokl.supabase.co'

function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export interface DriverScheduleRow {
  id: string
  driver_id: string
  schedule_type: 'recurring' | 'oneoff'
  weekday: number | null
  start_time: string | null
  end_time: string | null
  schedule_date: string | null
  created_at: string
}

export interface ScheduleMatch {
  schedule_id: string
  schedule_type: 'recurring' | 'oneoff'
  schedule_label: string
  start_time: string
  end_time: string
}

/**
 * 把 time 字串 ('HH:MM:SS' 或 'HH:MM') 轉成 'HH:MM' 方便比對。
 */
function normalizeTime(t: string): string {
  if (!t) return ''
  const [h, m] = t.split(':')
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
}

/**
 * 判斷 timeStr 是否落在 [startTime, endTime] 區間（含頭含尾）。
 * 區間支援跨日：例如 22:00 ~ 06:00 表示 22:00-23:59 或 00:00-06:00。
 */
export function isTimeWithinWindow(
  timeStr: string,
  startTime: string,
  endTime: string
): boolean {
  const time = normalizeTime(timeStr)
  const start = normalizeTime(startTime)
  const end = normalizeTime(endTime)

  if (start <= end) {
    return time >= start && time <= end
  }
  // 跨日區間
  return time >= start || time <= end
}

/**
 * 司機在給定的 dateTime 是否有排班。
 * - 取得所有 recurring：weekday 相同且時間在範圍
 * - 取得所有 oneoff：schedule_date 相同且時間在範圍
 * - 兩者任一命中即回 true
 */
export async function isWithinSchedule(
  driverId: string,
  dateTime: Date
): Promise<boolean> {
  if (!driverId || !dateTime) return false

  const weekday = dateTime.getUTCDay() // 0=Sun ... 6=Sat（與 Postgres EXTRACT(DOW) 預設一致）
  const dateStr = dateTime.toISOString().slice(0, 10) // YYYY-MM-DD
  const timeStr = dateTime.toISOString().slice(11, 19) // HH:MM:SS

  const supabaseAdmin = getAdminClient()

  const { data: schedules, error } = await supabaseAdmin
    .from('driver_schedules')
    .select('*')
    .eq('driver_id', driverId)

  if (error) {
    console.error('isWithinSchedule query error:', error)
    return false
  }

  if (!schedules || schedules.length === 0) {
    // 沒有任何排程：預設為「全天可接單」（向後相容舊司機）
    return true
  }

  for (const s of schedules as DriverScheduleRow[]) {
    if (s.schedule_type === 'recurring') {
      if (s.weekday === weekday && s.start_time && s.end_time) {
        if (isTimeWithinWindow(timeStr, s.start_time, s.end_time)) {
          return true
        }
      }
    } else if (s.schedule_type === 'oneoff') {
      if (s.schedule_date === dateStr && s.start_time && s.end_time) {
        if (isTimeWithinWindow(timeStr, s.start_time, s.end_time)) {
          return true
        }
      }
    }
  }

  return false
}

/**
 * 取得司機在給定 dateTime 命中了哪幾條排程（用於 UI 顯示）。
 */
export async function getScheduleMatches(
  driverId: string,
  dateTime: Date
): Promise<ScheduleMatch[]> {
  if (!driverId || !dateTime) return []

  const weekday = dateTime.getUTCDay()
  const dateStr = dateTime.toISOString().slice(0, 10)
  const timeStr = dateTime.toISOString().slice(11, 19)

  const supabaseAdmin = getAdminClient()
  const { data: schedules } = await supabaseAdmin
    .from('driver_schedules')
    .select('*')
    .eq('driver_id', driverId)

  if (!schedules) return []

  const matches: ScheduleMatch[] = []
  for (const s of schedules as DriverScheduleRow[]) {
    if (s.schedule_type === 'recurring') {
      if (s.weekday === weekday && s.start_time && s.end_time) {
        if (isTimeWithinWindow(timeStr, s.start_time, s.end_time)) {
          matches.push({
            schedule_id: s.id,
            schedule_type: 'recurring',
            schedule_label: `週${['日','一','二','三','四','五','六'][weekday]}`,
            start_time: s.start_time,
            end_time: s.end_time,
          })
        }
      }
    } else if (s.schedule_type === 'oneoff') {
      if (s.schedule_date === dateStr && s.start_time && s.end_time) {
        if (isTimeWithinWindow(timeStr, s.start_time, s.end_time)) {
          matches.push({
            schedule_id: s.id,
            schedule_type: 'oneoff',
            schedule_label: s.schedule_date,
            start_time: s.start_time,
            end_time: s.end_time,
          })
        }
      }
    }
  }

  return matches
}
