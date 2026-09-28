/**
 * 每日 20 條「近期熱門預約」模擬文案（seeded, lazy）
 *
 * 設計目標：
 *   - 每天 00:00 重新生成 20 條（lazy：以「當天日期 yyyymmdd」為 seed）
 *   - 同一個日期全天穩定產出同樣的 20 條（同一使用者當天看到一致內容）
 *   - 不寫 DB、不需要 cron；前端 marquee 每 15 秒換一批，後端每次 API 請求都根據當天 seed 重算
 *
 * 隱私規範：
 *   - 只顯示電話末四碼（隨機 [1000, 9999]）
 *   - 只顯示頭銜（先生 / 女士 / 同學 / 旅客），不顯示真實姓名
 *   - 文案為「近期熱門預約溫馨提示」性質，不承諾保證
 *
 * 池子豐富度（涵蓋）：
 *   - 時段：凌晨 1-5 / 早 7-9 / 午 12-14 / 晚 18-22
 *   - 路線：汕尾↔香港 / 深圳↔香港 / 汕尾↔深圳
 *   - 車型：7座埃爾法 / 5座豐田 / 9座商務
 *   - 頭銜：先生 / 女士 / 同學 / 旅客
 *   - 司機等級：金牌 / 銀牌 / 鑽石
 *   - 狀態詞：已順利抵達 / 司機已出發 / 訂單完成
 */

// ---------------- 資料池 ----------------

const TITLES = ['先生', '女士', '同學', '旅客'] as const

const VEHICLES = [
  { key: '7_seat', label: '7座埃爾法專車' },
  { key: '8_seat', label: '9座商務專車' },
  { key: '4_seat', label: '5座豐田專車' },
] as const

const ROUTES = [
  { from: '汕尾', to: '香港' },
  { from: '香港', to: '汕尾' },
  { from: '深圳', to: '香港' },
  { from: '香港', to: '深圳' },
  { from: '汕尾', to: '深圳' },
  { from: '深圳', to: '汕尾' },
] as const

const DRIVER_TIERS = ['金牌司機', '銀牌司機', '鑽石司機'] as const
const TIER_EMOJI: Record<(typeof DRIVER_TIERS)[number], string> = {
  金牌司機: '🥇',
  銀牌司機: '⭐',
  鑽石司機: '💎',
}

interface TimeSlot {
  label: string
  emoji: string
  /** 預設時段描述（會被 seeded 偏移覆寫） */
  description: string
}
const TIME_SLOTS: TimeSlot[] = [
  { label: '凌晨', emoji: '🌙', description: '今日凌晨' },
  { label: '上午', emoji: '🌅', description: '今日上午' },
  { label: '中午', emoji: '☀️', description: '今日中午' },
  { label: '下午', emoji: '🌤️', description: '今日下午' },
  { label: '晚上', emoji: '🌆', description: '今日晚上' },
]

const STATUS_PHRASES = [
  '成功預約',
  '已順利抵達目的地',
  '司機已出發',
  '訂單完成',
  '已預約成功',
] as const

const LEAD_PHRASES = [
  '15 分鐘前',
  '30 分鐘前',
  '1 小時前',
  '2 小時前',
  '3 小時前',
  '昨日',
  '今日凌晨',
  '昨日上午',
  '昨日下午',
] as const

const EMOJI_PREFIX = ['📱', '🚖', '🛺', '✅'] as const

// ---------------- Seeded RNG ----------------

/**
 * Mulberry32 — 輕量級 seeded PRNG
 * 用「當天日期 yyyymmdd」作為 seed，確保同一天產出同樣的 20 條
 */
function mulberry32(seedInt: number): () => number {
  let t = seedInt >>> 0
  return function () {
    t = (t + 0x6d2b79f5) >>> 0
    let r = t
    r = Math.imul(r ^ (r >>> 15), r | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 從「日期」產生 seed：YYYYMMDD → 整數
 * 例如：2026-09-27 → 20260927
 */
function dateToSeed(date: Date): number {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return Number(`${y}${m}${d}`)
}

/** 取得 seed 對應的當天 00:00 Date */
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

// ---------------- 選取輔助 ----------------

interface Rand {
  (): number
  int(min: number, max: number): number
  pick<T>(arr: readonly T[]): T
}

function makeRand(seedInt: number): Rand {
  const next = mulberry32(seedInt)
  const fn = next as Rand
  fn.int = (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min
  fn.pick = function pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(next() * arr.length)]
  }
  return fn
}

// ---------------- 文案模板 ----------------

/** 隨機電話末四碼（[1000, 9999]） */
function last4(rand: Rand): string {
  return String(rand.int(1000, 9999))
}

/**
 * 模板 1：預約型
 * 「📱 手機尾號1547先生 15 分鐘前成功預約汕尾→香港7座埃爾法專車 ✅」
 */
function templateBooked(rand: Rand): string {
  const title = rand.pick(TITLES)
  const vehicle = rand.pick(VEHICLES)
  const route = rand.pick(ROUTES)
  const lead = rand.pick(LEAD_PHRASES)
  const prefix = rand.pick(EMOJI_PREFIX)
  return `${prefix} 手機尾號${last4(rand)}${title} ${lead}成功預約${route.from}→${route.to}${vehicle.label} ✅`
}

/**
 * 模板 2：抵達型
 * 「📱 手機尾號8923女士 3 小時前順利抵達香港，司機金牌接送 ⭐」
 */
function templateArrived(rand: Rand): string {
  const title = rand.pick(TITLES)
  const route = rand.pick(ROUTES)
  const tier = rand.pick(DRIVER_TIERS)
  const emoji = TIER_EMOJI[tier]
  const vehicle = rand.pick(VEHICLES)
  const lead = rand.pick(LEAD_PHRASES)
  const prefix = rand.pick(EMOJI_PREFIX)
  return `${prefix} 手機尾號${last4(rand)}${title} ${lead}順利抵達${route.to}，${tier}接送${emoji}`
}

/**
 * 模板 3：出發型
 * 「📱 手機尾號4567同學 昨日上午預約深圳→香港9座商務，司機已出發 🚗」
 */
function templateDeparted(rand: Rand): string {
  const title = rand.pick(TITLES)
  const vehicle = rand.pick(VEHICLES)
  const route = rand.pick(ROUTES)
  const tier = rand.pick(DRIVER_TIERS)
  const emoji = TIER_EMOJI[tier]
  const slot = rand.pick(TIME_SLOTS)
  return `${slot.emoji} 手機尾號${last4(rand)}${title} ${slot.description}預約${route.from}→${route.to}${vehicle.label}，${tier}已出發${emoji}`
}

/**
 * 模板 4：跨夜型（凌晨抵達）
 * 「📱 手機尾號7788女士 今日凌晨抵達香港9座商務專車，銀牌司機服務 ⭐」
 */
function templateLateNight(rand: Rand): string {
  const title = rand.pick(TITLES)
  const vehicle = rand.pick(VEHICLES)
  const route = rand.pick(ROUTES)
  const tier = rand.pick(DRIVER_TIERS)
  const emoji = TIER_EMOJI[tier]
  return `🌙 手機尾號${last4(rand)}${title} 今日凌晨抵達${route.to}${vehicle.label}，${tier}服務${emoji}`
}

/**
 * 模板 5：完成型（含「金牌司機接單」）
 * 「📱 手機尾號2103旅客 2 小時前預約香港→汕尾5座豐田，金牌司機接單 🥇」
 */
function templateCompleted(rand: Rand): string {
  const title = rand.pick(TITLES)
  const vehicle = rand.pick(VEHICLES)
  const route = rand.pick(ROUTES)
  const tier = rand.pick(DRIVER_TIERS)
  const emoji = TIER_EMOJI[tier]
  const status = rand.pick(STATUS_PHRASES)
  const lead = rand.pick(LEAD_PHRASES)
  return `📱 手機尾號${last4(rand)}${title} ${lead}${status}${route.from}→${route.to}${vehicle.label}，${tier}${emoji}`
}

const TEMPLATES = [
  templateBooked,
  templateArrived,
  templateDeparted,
  templateLateNight,
  templateCompleted,
] as const

// ---------------- 對外 API ----------------

/**
 * 取得「當天」的 20 條穩定模擬熱訊
 * - 同一個日期全天產出同樣的 20 條
 * - 跨日自動切換（seed 變了）
 * - 不依賴 DB / 不需要 cron
 */
export function getDailyBookingTips(now: Date = new Date(), count: number = 20): string[] {
  const seedInt = dateToSeed(startOfDay(now))
  const rand = makeRand(seedInt)
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    // 每條訊息用「seed + index」再次偏移，避免同模板無限重複
    const subRand = makeRand(seedInt + i * 977)
    const tpl = TEMPLATES[i % TEMPLATES.length]
    out.push(tpl(subRand))
  }
  return out
}

/**
 * 取 5 條範例（給預覽 / 文檔使用）
 */
export function previewDailyBookingTips(now: Date = new Date(), count: number = 5): string[] {
  return getDailyBookingTips(now, count)
}

/** 對外導出 seed 計算（debug / 測試用） */
export function _seedForDate(date: Date): number {
  return dateToSeed(startOfDay(date))
}
