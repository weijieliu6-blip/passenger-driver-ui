import crypto from 'crypto'

/**
 * 釘釘推送工具（v1 完整版）
 *
 * 支援：
 * - text 訊息（舊格式相容）
 * - ActionCard 訊息（含「立即搶單」按鈕）
 * - 加簽（SEC 開頭的 secret）
 *
 * 環境變數：
 * - DINGTALK_WEBHOOK_URL: 群機器人 webhook（含 access_token）
 * - DINGTALK_SECRET: 加簽密鑰（SEC 開頭；可不填）
 */

const DINGTALK_WEBHOOK = process.env.DINGTALK_WEBHOOK_URL ?? ''
const DINGTALK_SECRET = process.env.DINGTALK_SECRET ?? ''

function generateSign(timestamp: number, secret: string): string {
  const stringToSign = `${timestamp}\n${secret}`
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(stringToSign)
  return encodeURIComponent(hmac.digest('base64'))
}

function buildSignedUrl(): { url: string; ok: boolean } {
  if (!DINGTALK_WEBHOOK) {
    return { url: '', ok: false }
  }
  // 如果沒設 secret，就不要附加 timestamp / sign
  if (!DINGTALK_SECRET) {
    return { url: DINGTALK_WEBHOOK, ok: true }
  }
  const timestamp = Date.now()
  const sign = generateSign(timestamp, DINGTALK_SECRET)
  // 防止原 URL 已有 query（一般不會有）
  const separator = DINGTALK_WEBHOOK.includes('?') ? '&' : '?'
  return {
    url: `${DINGTALK_WEBHOOK}${separator}timestamp=${timestamp}&sign=${sign}`,
    ok: true,
  }
}

/**
 * 內部：實際呼叫 webhook
 */
async function postToDingTalk(payload: unknown): Promise<{ success: boolean; error?: string; data?: unknown }> {
  const { url, ok } = buildSignedUrl()
  if (!ok) {
    console.warn('⚠️ 未設定 DINGTALK_WEBHOOK_URL，略過推送')
    return { success: false, error: 'DINGTALK_WEBHOOK_URL 未設定' }
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const result = (await response.json()) as { errcode?: number; errmsg?: string }

    if (result.errcode === 0) {
      return { success: true, data: result }
    }
    return { success: false, error: result.errmsg || `errcode=${result.errcode}`, data: result }
  } catch (err) {
    console.error('釘釘推送異常:', err)
    return { success: false, error: err instanceof Error ? err.message : '未知錯誤' }
  }
}

// ============== Text 訊息（相容舊介面） ==============

/**
 * 推播新訂單文字訊息（保留向後相容；新流程請用 pushOrderActionCard）
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sendDingTalkNotification(orderData: any) {
  const direction = orderData.direction || ''
  const pickup = orderData.pickupLocation || ''
  const dropoff = orderData.dropoffLocation || ''
  const passenger = orderData.passengerName || '乘客'
  const phone = orderData.passengerPhone || ''
  const departure = orderData.departureTime || ''
  const orderNumber = orderData.orderNumber || ''

  const text = `🚗 新訂單 - 待接單
━━━━━━━━━━━━━━━
📋 方向：${direction}
🕐 出發：${departure}
📍 起點：${pickup}
📍 終點：${dropoff}
👤 乘客：${passenger}
📞 電話：${phone}
━━━━━━━━━━━━━━━
訂單編號：${orderNumber}`

  return postToDingTalk({ msgtype: 'text', text: { content: text } })
}

/**
 * 推播新訂單純文字訊息（含搶單連結 URL）
 *
 * 與 pushOrderActionCard 不同之處：使用 msgtype=text，
 * 訊息內含完整搶單 URL 字串，司機可直接複製或點選。
 */
export async function pushOrderText(opts: {
  orderNumber: string
  pickup: string
  dropoff: string
  pickupTime: string
  carType: string
  passengers: number
  luggage: number
  passengerName: string
  passengerPhone: string
  estimatedFare?: number
  driverLink?: string
  grabToken?: string
  remark?: string
  direction?: 'hk_to_mainland' | 'mainland_to_hk' | string
}) {
  // 站點 URL 解析順序：
  // 1. DRIVER_SITE_URL — server-side env var (推薦，可隨時改)
  // 2. NEXT_PUBLIC_DRIVER_SITE_URL / NEXT_PUBLIC_SITE_URL — fallback (build-time inline)
  // 3. http://localhost:3000 — 開發環境 fallback
  const baseUrl =
    process.env.DRIVER_SITE_URL ||
    process.env.NEXT_PUBLIC_DRIVER_SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000'
  const token = opts.grabToken || opts.orderNumber
  const link = opts.driverLink || `${baseUrl}/driver/grab/${token}`

  const directionText =
    opts.direction === 'mainland_to_hk'
      ? '跨境專車：內地 → 香港'
      : opts.direction === 'hk_to_mainland'
        ? '跨境專車：香港 → 內地'
        : '跨境專車'

  // [測試模式] 若 body.testMode=true 則加 [測試] 前綴，方便測試訂單辨識
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isTest = (opts as any).testMode === true
  const headerLine = isTest ? '🧪 [測試] 新訂單 - 待接單' : '🚗 新訂單 - 待接單'
  // 注意：testMode 從呼叫端傳入（由 API route 從 request body 讀取）

  const text = [
    headerLine,
    '─────────────────',
    `📋 行程方向：${directionText}`,
    `🕐 出發時間：${opts.pickupTime}`,
    `📍 起點：${opts.pickup}`,
    `📍 終點：${opts.dropoff}`,
    `👤 乘客：${opts.passengerName}`,
    `📞 電話：${opts.passengerPhone}`,
    `💰 預估車資：HK$ ${opts.estimatedFare ? opts.estimatedFare.toLocaleString() : '待確認'}`,
    `👥 乘客人數：${opts.passengers}人`,
    `💼 行李數量：${opts.luggage}件`,
    opts.remark ? `📝 備註：${opts.remark}` : '',
    '─────────────────',
    `訂單編號：${opts.orderNumber}`,
    `提交時間：${new Date().toLocaleString('zh-HK', { hour12: false })}`,
    '─────────────────',
    '🔗 搶單連結（司機端）：',
    link,
  ]
    .filter(Boolean)
    .join('\n')

  return postToDingTalk({ msgtype: 'text', text: { content: text } })
}

// ============== ActionCard 訊息（新流程主用） ==============

export interface OrderActionCardInput {
  orderNumber: string
  direction: string
  pickupLocation: string
  pickupArea?: string | null
  dropoffLocation: string
  dropoffArea?: string | null
  departureTime: string
  vehicleType: string
  passengers: number
  luggage: number
  passengerName?: string | null
  passengerPhone?: string
  estimatedFare?: number | null
  grabToken: string
  /** 完整搶單連結（base + token），若未提供則使用 NEXT_PUBLIC_DRIVER_SITE_URL + /driver/grab/{token} */
  grabUrl?: string
}

/**
 * 推播 ActionCard：標題 + 行程摘要 + 單個按鈕（🚗 立即搶單）
 */
export async function pushOrderActionCard(input: OrderActionCardInput) {
  const baseUrl =
    process.env.DRIVER_SITE_URL ||
    process.env.NEXT_PUBLIC_DRIVER_SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000'
  const grabUrl = input.grabUrl ?? `${baseUrl}/driver/grab/${input.grabToken}`

  const vehicleMap: Record<string, string> = {
    '4_seat': '4座車',
    '5_seat': '5座豐田',
    '7_seat': '7座埃爾法',
    '8_seat': '8座車',
    '9_seat': '9座商務',
  }
  const vehicle = vehicleMap[input.vehicleType] ?? input.vehicleType

  const fareText = input.estimatedFare ? `HK$ ${input.estimatedFare}` : '待確認'

  const pickup = input.pickupArea
    ? `${input.pickupLocation} ${input.pickupArea}`
    : input.pickupLocation
  const dropoff = input.dropoffArea
    ? `${input.dropoffLocation} ${input.dropoffArea}`
    : input.dropoffLocation

  const phoneTail = input.passengerPhone ? `尾號 ${input.passengerPhone.slice(-4)}` : ''
  const passengerLine = phoneTail
    ? `${phoneTail} ${input.passengerName ?? '乘客'}`
    : input.passengerName ?? '乘客'

  const text = `**路線**：${pickup} → ${dropoff}
**時間**：${input.departureTime}
**車型**：${vehicle}
**人數**：${input.passengers}人 / 行李 ${input.luggage}件
**乘客**：${passengerLine}
**預估車資**：${fareText}`

  const payload = {
    msgtype: 'actionCard',
    actionCard: {
      title: '🚖 新訂單待搶單',
      text,
      singleTitle: '🚗 立即搶單',
      singleURL: grabUrl,
    },
  }

  return postToDingTalk(payload)
}

// ============== 接單/取消通知（保留） ==============

export async function notifyOrderGrabbed(
  orderNumber: string,
  driverName: string,
  driverPhone: string
) {
  const text = `✅ 訂單已接 #${orderNumber}

司機：${driverName}
電話：${driverPhone}

請及時聯繫乘客確認行程細節`
  return postToDingTalk({ msgtype: 'text', text: { content: text } })
}

export async function notifyOrderCancelled(
  orderNumber: string,
  pickupArea: string,
  dropoffArea: string
) {
  const text = `❌ 訂單已取消 #${orderNumber}

路線：${pickupArea} → ${dropoffArea}

乘客已取消此訂單，請勿接單`
  return postToDingTalk({ msgtype: 'text', text: { content: text } })
}

/**
 * 司機確認價格通知
 */
export async function notifyOrderPriceConfirmed(
  orderNumber: string,
  driverName: string,
  driverPhone: string,
  price: number,
  currency: 'HKD' | 'CNY'
) {
  const currencySymbol = currency === 'CNY' ? '¥' : 'HK$'
  const text = `💰 價格已確認 #${orderNumber}

司機：${driverName}
電話：${driverPhone}
確認車資：${currencySymbol} ${price.toLocaleString()}

請等待乘客最終確認，祝您旅途愉快！`
  return postToDingTalk({ msgtype: 'text', text: { content: text } })
}

/**
 * 乘客確認接單通知（推送給司機 / 釘釘群）
 *
 * 觸發：乘客點擊「確認接單」接受報價後
 * 內容：訂單編號 + 路線 + 出發時間 + 確認金額 + 乘客聯繫電話
 */
export async function notifyOrderAcceptedByPassenger(
  orderNumber: string,
  pickupLocation: string,
  pickupArea: string | null,
  dropoffLocation: string,
  dropoffArea: string | null,
  departureTime: string,
  price: number,
  currency: 'HKD' | 'CNY',
  passengerName: string,
  passengerPhone: string,
  // driverName 預留給未來模板擴充（v1.1 起將在訊息顯示司機姓名）
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  driverName?: string | null
) {
  const currencySymbol = currency === 'CNY' ? '¥' : 'HK$'
  const dt = new Date(departureTime)
  const dtLabel = isNaN(dt.getTime())
    ? departureTime
    : `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`

  const pickupText = pickupArea ? `${pickupLocation} - ${pickupArea}` : pickupLocation
  const dropoffText = dropoffArea ? `${dropoffLocation} - ${dropoffArea}` : dropoffLocation

  const text = `✅ 乘客已確認 #${orderNumber}

乘客已接受您的報價，行程確定！

🚗 路線：${pickupText} → ${dropoffText}
📅 出發：${dtLabel}
💰 車資：${currencySymbol} ${price.toLocaleString()}
👤 乘客：${passengerName}
📞 聯繫：${passengerPhone}

請準時於出發地點接送乘客，保持電話暢通。祝您旅途愉快！`
  return postToDingTalk({ msgtype: 'text', text: { content: text } })
}

// ============== 行程階段通知（v1 追蹤系統） ==============

/**
 * 司機抵達上車點通知（推送到釘釘群）
 *
 * 觸發：司機在 execute 頁點擊「已抵達上車點」
 * 內容：訂單編號 + 司機姓名 + 上車地點 + 聯繫電話
 */
export async function notifyDriverArrived(
  orderNumber: string,
  driverName: string,
  driverPhone: string | null | undefined,
  pickupLocation: string,
  pickupArea: string | null | undefined,
  passengerName: string | null | undefined,
  arrivalTime: string
) {
  const pickupText = pickupArea ? `${pickupLocation} - ${pickupArea}` : pickupLocation
  const passengerLine = passengerName ? `請乘客 ${passengerName} 準備上車` : '請乘客準備上車'
  const phoneLine = driverPhone ? `\n📞 司機聯繫：${driverPhone}` : ''

  const text = `📍 司機已抵達 #${orderNumber}

司機：${driverName}${phoneLine}
到達時間：${arrivalTime}

🚏 上車地點：${pickupText}

${passengerLine}。`
  return postToDingTalk({ msgtype: 'text', text: { content: text } })
}

/**
 * 行程開始通知（乘客已上車，推送到釘釘群）
 *
 * 觸發：司機在 execute 頁點擊「乘客已上車 / 行程開始」
 * 內容：訂單編號 + 司機 + 路線 + 預計抵達時間
 */
export async function notifyTripStarted(
  orderNumber: string,
  driverName: string,
  driverPhone: string | null | undefined,
  pickupLocation: string,
  pickupArea: string | null | undefined,
  dropoffLocation: string,
  dropoffArea: string | null | undefined,
  passengerName: string | null | undefined,
  startedAt: string
) {
  const pickupText = pickupArea ? `${pickupLocation} - ${pickupArea}` : pickupLocation
  const dropoffText = dropoffArea ? `${dropoffLocation} - ${dropoffArea}` : dropoffLocation
  const phoneLine = driverPhone ? `\n📞 司機聯繫：${driverPhone}` : ''
  const passengerLine = passengerName ? `乘客：${passengerName}` : '乘客已上車'

  const text = `🚗 行程開始 #${orderNumber}

${passengerLine}，司機 ${driverName} 已出發${phoneLine}
出發時間：${startedAt}

🚏 ${pickupText} → 🏁 ${dropoffText}

敬請期待。`
  return postToDingTalk({ msgtype: 'text', text: { content: text } })
}

/**
 * 行程完成通知（已抵達目的地，推送到釘釘群）
 *
 * 觸發：司機在 execute 頁點擊「行程已完成」
 * 內容：訂單編號 + 司機 + 路線 + 確認金額 + 完成時間
 */
export async function notifyTripCompleted(
  orderNumber: string,
  driverName: string,
  pickupLocation: string,
  pickupArea: string | null | undefined,
  dropoffLocation: string,
  dropoffArea: string | null | undefined,
  passengerName: string | null | undefined,
  price: number | null | undefined,
  currency: 'HKD' | 'CNY' | null | undefined,
  completedAt: string
) {
  const pickupText = pickupArea ? `${pickupLocation} - ${pickupArea}` : pickupLocation
  const dropoffText = dropoffArea ? `${dropoffLocation} - ${dropoffArea}` : dropoffLocation

  let priceLine = ''
  if (price != null && currency) {
    const symbol = currency === 'CNY' ? '¥' : 'HK$'
    priceLine = `\n💰 確認車資：${symbol} ${price.toLocaleString()}`
  }

  const passengerLine = passengerName ? `乘客：${passengerName}` : '乘客'

  const text = `✅ 行程完成 #${orderNumber}

${passengerLine} 已順利抵達目的地。
完成時間：${completedAt}

🚏 ${pickupText} → 🏁 ${dropoffText}${priceLine}

司機：${driverName}，感謝您的服務！`
  return postToDingTalk({ msgtype: 'text', text: { content: text } })
}

/**
 * 司機發送訊息通知（推送到釘釘群）
 *
 * 觸發：司機在 execute 頁傳送文字訊息
 * 內容：訂單編號 + 司機姓名 + 訊息內容（會過濾電話號碼避免隱私外洩）
 */
export async function notifyDriverMessage(
  orderNumber: string,
  driverName: string,
  passengerName: string | null | undefined,
  message: string
) {
  // 安全過濾：將連續 8 碼以上數字遮罩，避免司機／乘客電話外洩
  const safeMessage = message
    .replace(/\d{8,}/g, (m) => `${m.slice(0, 2)}****${m.slice(-2)}`)
    .slice(0, 200)

  const passengerLine = passengerName ? `給乘客 ${passengerName}` : '給乘客'

  const text = `💬 司機訊息 #${orderNumber}

司機 ${driverName} ${passengerLine}：
「${safeMessage}」`
  return postToDingTalk({ msgtype: 'text', text: { content: text } })
}