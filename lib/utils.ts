/**
 * 格式化日期時間
 */
export function formatDateTime(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleString('zh-HK', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

/**
 * 格式化時間（僅時間）
 */
export function formatTime(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleString('zh-HK', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

/**
 * 格式化日期（僅日期）
 */
export function formatDate(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleString('zh-HK', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

/**
 * 格式化價格
 */
export function formatPrice(price: number): string {
  return `HKD $${price.toFixed(0)}`
}

/**
 * 獲取相對時間描述（例如：2分鐘前）
 */
export function getRelativeTime(date: string | Date): string {
  const now = new Date()
  const d = new Date(date)
  const diffMs = now.getTime() - d.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) {
    return '剛剛'
  } else if (diffMinutes < 60) {
    return `${diffMinutes}分鐘前`
  } else if (diffHours < 24) {
    return `${diffHours}小時前`
  } else {
    return `${diffDays}天前`
  }
}

/**
 * 驗證手機號碼格式（香港/內地）
 */
export function validatePhone(phone: string): boolean {
  // 簡單驗證：8位數字（香港）或11位數字（內地）
  const hkPattern = /^[0-9]{8}$/
  const cnPattern = /^1[0-9]{10}$/
  
  return hkPattern.test(phone) || cnPattern.test(phone)
}
