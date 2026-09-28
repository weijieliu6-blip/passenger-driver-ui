/**
 * 節假日文案工具
 *
 * - 不依賴網路 API，使用本地硬編碼的節假日日期（國曆 + 農曆近似，農曆用「常見年份對照」）
 * - 對外只回傳純文字訊息，不含個資
 * - 安全：所有文案都標明「近期熱門預約溫馨提示」「建議」語氣，不承諾保證
 */

export type HolidayKey =
  | 'spring_festival' // 春節
  | 'lantern' // 元宵
  | 'qingming' // 清明
  | 'labor' // 勞動節
  | 'duanwu' // 端午
  | 'qixi' // 七夕
  | 'mid_autumn' // 中秋
  | 'national_day' // 國慶

interface HolidayDef {
  key: HolidayKey
  name: string
  /** YYYY-MM-DD（國曆） */
  dates: string[]
  /** 預熱文案：節日當日前幾天就開始出現提醒 */
  leadDays: number
  /** 該節日主文案（節日當週） */
  messages: string[]
}

/**
 * 注意：農曆節日（春節、端午、中秋、七夕）在不同年份會落在不同國曆日期。
 * 這裡僅列出 2025–2027 的近似國曆日期（公曆）作為支撐。
 * 若要長期穩定使用，建議改用 `lunar-typescript` 之類套件（目前專案沒裝）。
 */
const HOLIDAYS: HolidayDef[] = [
  {
    key: 'spring_festival',
    name: '春節',
    leadDays: 30,
    dates: ['2025-01-29', '2026-02-17', '2027-02-06'],
    messages: [
      '🧧 春節將近，建議您提前預約，避免節假日車輛緊張',
      '🎊 春節期間跨境車流增多，請提前 24 小時預約 7 座埃爾法/9 座商務',
      '✨ 近期熱門預約溫馨提示：春節前後司機緊張，建議您提早預約以保證出行',
    ],
  },
  {
    key: 'lantern',
    name: '元宵節',
    leadDays: 5,
    dates: ['2025-02-12', '2026-03-03', '2027-02-23'],
    messages: [
      '🏮 元宵佳節，祝您闔家團圓；近期熱門預約溫馨提示，建議提前預約出行',
    ],
  },
  {
    key: 'qingming',
    name: '清明節',
    leadDays: 7,
    dates: ['2025-04-04', '2026-04-05', '2027-04-05'],
    messages: [
      '🌿 清明假期返鄉祭祖，建議您提前預約跨境專車',
      '🕯️ 近期熱門預約溫馨提示：清明期間出行需求增加，請提前 24 小時預約',
    ],
  },
  {
    key: 'labor',
    name: '勞動節',
    leadDays: 5,
    dates: ['2025-05-01', '2026-05-01', '2027-05-01'],
    messages: [
      '💪 五一假期出行小高峰，建議您提前預約 7 座埃爾法/9 座商務專車',
      '🚗 近期熱門預約溫馨提示：勞動節期間司機緊張，請提前 24 小時預約',
    ],
  },
  {
    key: 'duanwu',
    name: '端午節',
    leadDays: 5,
    dates: ['2025-05-31', '2026-06-19', '2027-06-09'],
    messages: [
      '🐉 端午佳節將至，建議您提前預約 7 座埃爾法專車',
      '🚗 近期熱門預約溫馨提示：端午期間出行需求增加，請提前 24 小時預約',
    ],
  },
  {
    key: 'qixi',
    name: '七夕',
    leadDays: 3,
    dates: ['2025-08-29', '2026-08-19', '2027-08-19'],
    messages: [
      '💞 七夕佳節，平台祝您和家人出行順利；近期熱門預約溫馨提示，建議提前預約',
    ],
  },
  {
    key: 'mid_autumn',
    name: '中秋節',
    leadDays: 7,
    dates: ['2025-10-06', '2026-09-25', '2027-09-15'],
    messages: [
      '🎉 中秋佳節將至，建議您提前 24 小時預約，避開節假日預約高峰！',
      '🥮 中秋期間跨境出行需求增加，7 座埃爾法/9 座商務建議提前預約',
      '🌕 近期熱門預約溫馨提示：中秋假期司機緊張，請提早 24 小時預約以保證出行',
    ],
  },
  {
    key: 'national_day',
    name: '國慶',
    leadDays: 14,
    dates: ['2025-10-01', '2026-10-01', '2027-10-01'],
    messages: [
      '🚗 國慶假期提醒：節假日司機緊張，請提前 24 小時預約專車',
      '🇨🇳 國慶黃金週出行小高峰，建議您提前預約 7 座埃爾法/9 座商務',
      '📅 近期熱門預約溫馨提示：國慶期間出行需求集中，請提前 24 小時預約',
    ],
  },
]

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

function parseDate(yyyy_mm_dd: string): Date {
  const [y, m, d] = yyyy_mm_dd.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * 取得目前時間應該出現的節假日文案（含預熱期）。
 * 不顯示個資，僅作為「近期熱門預約溫馨提示」。
 */
export function getHolidayMessages(now: Date = new Date()): string[] {
  const messages: string[] = []
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  for (const h of HOLIDAYS) {
    // 找距離 today 最近的節日
    let nearest: { date: Date; diff: number } | null = null
    for (const ds of h.dates) {
      const d = parseDate(ds)
      const diff = daysBetween(today, d)
      if (nearest === null || Math.abs(diff) < Math.abs(nearest.diff)) {
        nearest = { date: d, diff }
      }
    }
    if (!nearest) continue

    // 節日當天（diff === 0），或節日前 leadDays 天內 → 啟用文案
    if (nearest.diff <= 0 && nearest.diff >= -3) {
      // 節日當天到 +3 天
      messages.push(...h.messages)
    } else if (nearest.diff > 0 && nearest.diff <= h.leadDays) {
      // 預熱期
      messages.push(...h.messages)
    }
  }

  return messages
}

/** 列出目前所有節假日狀態（debug / 監控用） */
export function listHolidayStatuses(now: Date = new Date()): Array<{
  key: HolidayKey
  name: string
  nearestDate: string
  diffDays: number
  active: boolean
}> {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return HOLIDAYS.map((h) => {
    let nearest: { date: Date; diff: number } | null = null
    for (const ds of h.dates) {
      const d = parseDate(ds)
      const diff = daysBetween(today, d)
      if (nearest === null || Math.abs(diff) < Math.abs(nearest.diff)) {
        nearest = { date: d, diff }
      }
    }
    const active =
      !!nearest &&
      ((nearest.diff <= 0 && nearest.diff >= -3) ||
        (nearest.diff > 0 && nearest.diff <= h.leadDays))
    return {
      key: h.key,
      name: h.name,
      nearestDate: nearest ? nearest.date.toISOString().slice(0, 10) : '-',
      diffDays: nearest ? nearest.diff : 0,
      active,
    }
  })
}