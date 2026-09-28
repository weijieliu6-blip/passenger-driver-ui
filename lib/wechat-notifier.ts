/**
 * 微信推送通知工具
 * 用途：发送订单通知到企业微信群
 */

interface OrderNotification {
  orderId: string
  orderNumber: string
  pickupArea: string
  dropoffArea: string
  departureTime: string
  passengers: number
  luggage: number
  vehicleType: string
  hasChild?: boolean
  childType?: string
  notes?: string
  grabToken: string
}

/**
 * 获取车型显示名称
 */
function getVehicleTypeName(type: string): string {
  const names: Record<string, string> = {
    '4_seat': '4座车',
    '7_seat': '7座车',
    '8_seat': '8座车'
  }
  return names[type] || type
}

/**
 * 格式化日期时间
 * 支持多种格式：
 * - ISO 时间戳: "2026-09-20T10:00:00"
 * - 纯时间: "10:00"
 * - 日期+时间: "2026-09-20 10:00"
 */
function formatDateTime(dateStr: string): string {
  if (!dateStr) return '待確認'
  
  // 如果是纯时间格式 "HH:MM"
  if (/^\d{1,2}:\d{2}$/.test(dateStr)) {
    return dateStr
  }
  
  // 如果是日期+时间 "YYYY-MM-DD HH:MM"
  const isoLikeMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/)
  if (isoLikeMatch) {
    return `${isoLikeMatch[1]}-${isoLikeMatch[2]}-${isoLikeMatch[3]} ${isoLikeMatch[4]}:${isoLikeMatch[5]}`
  }
  
  const date = new Date(dateStr)
  
  // 检查是否为 Invalid Date
  if (isNaN(date.getTime())) {
    return dateStr  // 原始字符串作為 fallback
  }
  
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  
  return `${y}-${m}-${d} ${h}:${min}`
}

/**
 * 推送新订单到企业微信群
 */
export async function pushOrderToWechat(order: OrderNotification): Promise<boolean> {
  const webhookUrl = process.env.WECHAT_WEBHOOK_URL
  
  if (!webhookUrl) {
    console.error('❌ 未配置 WECHAT_WEBHOOK_URL，无法推送订单')
    return false
  }
  
  // 生成抢单链接
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const grabUrl = `${siteUrl}/grab/${order.grabToken}`
  
  // 构建孩童信息
  let childInfo = ''
  if (order.hasChild && order.childType) {
    if (order.childType === 'infant') {
      childInfo = ' | 👶 嬰兒'
    } else if (order.childType === 'over_3') {
      childInfo = ' | 👶 3歲以上孩童'
    }
  }
  
  // 构建 Markdown 消息
  const message = {
    msgtype: 'markdown',
    markdown: {
      content: `## 🚗 新订单通知 #${order.orderNumber}

**📍 路线**
${order.pickupArea} → ${order.dropoffArea}

**⏰ 出发时间**
${formatDateTime(order.departureTime)}

**👥 乘车信息**
人数：${order.passengers}人 | 行李：${order.luggage}件 | 车型：${getVehicleTypeName(order.vehicleType)}${childInfo}

${order.notes ? `**📝 备注**\n${order.notes}\n` : ''}
---
[👉 立即抢单](${grabUrl})

<@all>`
    }
  }
  
  try {
    console.log('📤 推送订单到企业微信:', order.orderNumber)
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })
    
    const result = await response.json()
    
    if (result.errcode !== 0) {
      throw new Error(`推送失败: ${result.errmsg} (errcode: ${result.errcode})`)
    }
    
    console.log('✅ 订单推送成功:', order.orderNumber)
    return true
    
  } catch (error) {
    console.error('❌ 订单推送失败:', error)
    // TODO: 发送告警通知管理员
    return false
  }
}

/**
 * 推送订单已被抢的通知
 */
export async function notifyOrderGrabbed(
  orderNumber: string,
  driverName: string,
  driverPhone: string
): Promise<boolean> {
  const webhookUrl = process.env.WECHAT_WEBHOOK_URL
  
  if (!webhookUrl) {
    return false
  }
  
  const message = {
    msgtype: 'text',
    text: {
      content: `✅ 订单已接 #${orderNumber}\n\n司机：${driverName}\n电话：${driverPhone}`
    }
  }
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })
    
    const result = await response.json()
    return result.errcode === 0
    
  } catch (error) {
    console.error('❌ 接单通知推送失败:', error)
    return false
  }
}

/**
 * 推送订单已取消的通知
 */
export async function notifyOrderCancelled(
  orderNumber: string,
  pickupArea: string,
  dropoffArea: string
): Promise<boolean> {
  const webhookUrl = process.env.WECHAT_WEBHOOK_URL
  
  if (!webhookUrl) {
    return false
  }
  
  const message = {
    msgtype: 'text',
    text: {
      content: `❌ 订单已取消 #${orderNumber}\n路线：${pickupArea} → ${dropoffArea}`
    }
  }
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })
    
    const result = await response.json()
    return result.errcode === 0
    
  } catch (error) {
    console.error('❌ 取消通知推送失败:', error)
    return false
  }
}

/**
 * 推送每日订单统计
 */
export async function pushDailySummary(stats: {
  date: string
  totalOrders: number
  grabbedOrders: number
  pendingOrders: number
  cancelledOrders: number
}): Promise<boolean> {
  const webhookUrl = process.env.WECHAT_WEBHOOK_URL
  
  if (!webhookUrl) {
    return false
  }
  
  const grabRate = stats.totalOrders > 0 
    ? ((stats.grabbedOrders / stats.totalOrders) * 100).toFixed(1)
    : '0'
  
  const message = {
    msgtype: 'markdown',
    markdown: {
      content: `## 📊 ${stats.date} 订单统计

**新增订单**：${stats.totalOrders} 单
**已完成**：${stats.grabbedOrders} 单
**已取消**：${stats.cancelledOrders} 单
**待接单**：${stats.pendingOrders} 单

**抢单率**：${grabRate}%

继续加油！🚀`
    }
  }
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })
    
    const result = await response.json()
    return result.errcode === 0
    
  } catch (error) {
    console.error('❌ 统计推送失败:', error)
    return false
  }
}
