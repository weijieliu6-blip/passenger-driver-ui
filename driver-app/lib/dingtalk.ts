import crypto from 'crypto'

const DINGTALK_WEBHOOK = 'https://oapi.dingtalk.com/robot/send?access_token=2636db90898a49fb2e7da29d1b642564473a65da40471cdd68c986c12eb68ec6'
const DINGTALK_SECRET = 'SECca918ddf91049c4f55a35fad0fb8af1eab3ef390cc112e6422f2050c75c34a7b'

function generateSign(timestamp: number, secret: string): string {
  const stringToSign = `${timestamp}\n${secret}`
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(stringToSign)
  const sign = encodeURIComponent(hmac.digest('base64'))
  return sign
}

export async function sendDingTalkNotification(orderData: any) {
  const timestamp = Date.now()
  const sign = generateSign(timestamp, DINGTALK_SECRET)
  const url = `${DINGTALK_WEBHOOK}&timestamp=${timestamp}&sign=${sign}`

  const getDirectionText = (serviceType: string, direction: string) => {
    if (serviceType === 'cross_border') {
      if (direction === 'hk_to_mainland') return '跨境專車：香港 → 內地'
      if (direction === 'mainland_to_hk') return '跨境專車：內地 → 香港'
    } else if (serviceType === 'mainland_local') {
      if (direction === 'sz_to_sw') return '內地專車：深圳 → 汕尾'
      if (direction === 'sw_to_sz') return '內地專車：汕尾 → 深圳'
    }
    return direction
  }

  const direction = getDirectionText(orderData.serviceType, orderData.direction)

  const vehicleMap: Record<string, string> = {
    '4_seat': '4座車',
    '7_seat': '7座車',
    '8_seat': '8座車'
  }
  const vehicle = vehicleMap[orderData.vehicleType] || orderData.vehicleType

  const fare = orderData.estimatedFare
    ? `HK$ ${orderData.estimatedFare.minFare} - ${orderData.estimatedFare.maxFare}`
    : '待確認'

  let departureTimeStr = '待確認'

  const getTimePeriod = (hour: number) => {
    if (hour >= 5 && hour < 12) return '早上'
    if (hour >= 12 && hour < 18) return '下午'
    return '晚上'
  }

  const getChineseWeekdayFromDate = (y: number, m: number, d: number) => {
    const date = new Date(y, m - 1, d)
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    return weekdays[date.getDay()]
  }

  let year = 0, month = 0, day = 0, hour = 0, minute = 0
  let parsed = false

  if (orderData.departureDate && orderData.departureTime) {
    const dateMatch = orderData.departureDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
    const timeMatch = orderData.departureTime.match(/^(\d{1,2}):(\d{2})/)

    if (dateMatch && timeMatch) {
      year = parseInt(dateMatch[1])
      month = parseInt(dateMatch[2])
      day = parseInt(dateMatch[3])
      hour = parseInt(timeMatch[1])
      minute = parseInt(timeMatch[2])
      parsed = true
    }
  }

  if (!parsed && orderData.departureTime) {
    const dt = new Date(orderData.departureTime)
    if (!isNaN(dt.getTime())) {
      year = dt.getFullYear()
      month = dt.getMonth() + 1
      day = dt.getDate()
      hour = dt.getHours()
      minute = dt.getMinutes()
      parsed = true
    }
  }

  if (parsed && year > 0) {
    const weekday = getChineseWeekdayFromDate(year, month, day)
    const period = getTimePeriod(hour)
    const hourStr = hour.toString().padStart(2, '0')
    const minuteStr = minute.toString().padStart(2, '0')

    departureTimeStr = `${year}年${month}月${day}日(${weekday}) ${period} ${hourStr}:${minuteStr}`
  }

  const message = {
    msgtype: 'text',
    text: {
      content: `🚗 新訂單 - 待接單
━━━━━━━━━━━━━━━
📋 行程方向：${direction}
🕐 出發時間：${departureTimeStr}
📍 起點：${orderData.pickupLocation}${orderData.pickupArea ? ` - ${orderData.pickupArea}` : ''}
📍 終點：${orderData.dropoffLocation}${orderData.dropoffArea ? ` - ${orderData.dropoffArea}` : ''}
👤 乘客：${orderData.passengerName}
📞 電話：${orderData.passengerPhone}
💰 預估車資：${fare}
🚙 車型：${vehicle}
👥 乘客人數：${orderData.passengers}人
🧳 行李數量：${orderData.luggage}件
${orderData.hasChild ? `👶 孩童：${orderData.childType === 'infant' ? '3歲以下（不佔座）' : '3歲以上（佔座）'}` : ''}
${orderData.isCharter ? '📦 包車服務：是' : ''}
${orderData.passengerNotes ? `📝 備註：${orderData.passengerNotes}` : ''}
━━━━━━━━━━━━━━━
訂單編號：${orderData.orderNumber || '#' + Date.now().toString().slice(-8)}
提交時間：${new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' })}`
    }
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    })

    const result = await response.json()

    if (result.errcode === 0) {
      console.log('钉钉通知发送成功')
      return { success: true, message: '订单已发送到司机群' }
    } else {
      console.error('钉钉通知发送失败:', result)
      return { success: false, error: result.errmsg }
    }
  } catch (error) {
    console.error('钉钉通知发送异常:', error)
    return { success: false, error: '发送失败' }
  }
}

export async function notifyOrderGrabbed(
  orderNumber: string,
  driverName: string,
  driverPhone: string
) {
  const timestamp = Date.now()
  const sign = generateSign(timestamp, DINGTALK_SECRET)
  const url = `${DINGTALK_WEBHOOK}&timestamp=${timestamp}&sign=${sign}`

  const message = {
    msgtype: 'text',
    text: {
      content: `✅ 訂單已接 #${orderNumber}

司機：${driverName}
電話：${driverPhone}

請及時聯繫乘客確認行程細節`
    }
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    })

    const result = await response.json()

    if (result.errcode === 0) {
      console.log('✅ 钉钉接单通知发送成功')
      return { success: true }
    } else {
      console.error('❌ 钉钉接单通知发送失败:', result)
      return { success: false, error: result.errmsg }
    }
  } catch (error) {
    console.error('❌ 钉钉接单通知异常:', error)
    return { success: false, error: '发送失败' }
  }
}

export async function notifyOrderCancelled(
  orderNumber: string,
  pickupArea: string,
  dropoffArea: string
) {
  const timestamp = Date.now()
  const sign = generateSign(timestamp, DINGTALK_SECRET)
  const url = `${DINGTALK_WEBHOOK}&timestamp=${timestamp}&sign=${sign}`

  const message = {
    msgtype: 'text',
    text: {
      content: `❌ 訂單已取消 #${orderNumber}

路線：${pickupArea} → ${dropoffArea}

乘客已取消此訂單，請勿接單`
    }
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    })

    const result = await response.json()

    if (result.errcode === 0) {
      console.log('✅ 钉钉取消通知发送成功')
      return { success: true }
    } else {
      console.error('❌ 钉钉取消通知发送失败:', result)
      return { success: false, error: result.errmsg }
    }
  } catch (error) {
    console.error('❌ 钉钉取消通知异常:', error)
    return { success: false, error: '发送失败' }
  }
}
