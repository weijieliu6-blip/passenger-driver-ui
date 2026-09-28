/**
 * 用戶認證相關的工具函數
 */

export type Region = 'hk' | 'mainland'

export interface PhoneInfo {
  region: Region
  localNumber: string  // 不含區號的本地號碼
  fullNumber: string   // 含 +852/+86 前綴的完整號碼
}

// 香港手機號格式：以 5/6/7/8/9 開頭的 8 位數字
const HK_PHONE_REGEX = /^[5689]\d{7}$/

// 中國內地手機號格式：以 1[3-9] 開頭的 11 位數字
const MAINLAND_PHONE_REGEX = /^1[3-9]\d{9}$/

/**
 * 清理電話號碼（去除空格、+號、括號、-）
 */
export function cleanPhone(phone: string): string {
  return phone.replace(/[\s\-+()]/g, '')
}

/**
 * 驗證香港手機號
 */
export function isValidHKPhone(phone: string): boolean {
  const cleaned = cleanPhone(phone)
  return HK_PHONE_REGEX.test(cleaned)
}

/**
 * 驗證中國內地手機號
 */
export function isValidMainlandPhone(phone: string): boolean {
  const cleaned = cleanPhone(phone)
  return MAINLAND_PHONE_REGEX.test(cleaned)
}

/**
 * 解析電話號碼（自動判斷地區）
 * 支持格式：
 *   - 91234567 (純香港號碼)
 *   - 13800138000 (純內地號碼)
 *   - +85291234567
 *   - +8613800138000
 *   - 85291234567
 *   - 8613800138000
 */
export function parsePhone(input: string): PhoneInfo | null {
  const cleaned = cleanPhone(input)
  
  // 嘗試匹配 +852 前綴
  if (cleaned.startsWith('852')) {
    const local = cleaned.slice(3)
    if (isValidHKPhone(local)) {
      return {
        region: 'hk',
        localNumber: local,
        fullNumber: `+852${local}`
      }
    }
    return null
  }
  
  // 嘗試匹配 +86 前綴
  if (cleaned.startsWith('86') && cleaned.length === 13) {
    const local = cleaned.slice(2)
    if (isValidMainlandPhone(local)) {
      return {
        region: 'mainland',
        localNumber: local,
        fullNumber: `+86${local}`
      }
    }
    return null
  }
  
  // 純號碼（無區號）
  if (isValidHKPhone(cleaned)) {
    return {
      region: 'hk',
      localNumber: cleaned,
      fullNumber: `+852${cleaned}`
    }
  }
  
  if (isValidMainlandPhone(cleaned)) {
    return {
      region: 'mainland',
      localNumber: cleaned,
      fullNumber: `+86${cleaned}`
    }
  }
  
  return null
}

/**
 * 將電話轉換為內部 email（用於 Supabase auth）
 * 包含地區前綴避免衝突：
 *   - HK: phone_hk_91234567@hkcar.app
 *   - Mainland: phone_cn_13800138000@hkcar.app
 */
export function phoneToEmail(phone: string, region: Region): string {
  const local = cleanPhone(phone)
  const prefix = region === 'hk' ? 'phone_hk_' : 'phone_cn_'
  return `${prefix}${local}@hkcar.app`
}

/**
 * 從內部 email 反推電話
 */
export function emailToPhone(email: string): { region: Region; phone: string } | null {
  const hkMatch = email.match(/^phone_hk_(\d{8})@hkcar\.app$/)
  if (hkMatch) return { region: 'hk', phone: hkMatch[1] }
  
  const cnMatch = email.match(/^phone_cn_(\d{11})@hkcar\.app$/)
  if (cnMatch) return { region: 'mainland', phone: cnMatch[1] }
  
  return null
}

/**
 * 判斷輸入是電郵還是電話
 */
export function detectInputType(input: string): 'email' | 'phone' {
  if (input.includes('@')) return 'email'
  return 'phone'
}

/**
 * 驗證電郵格式
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * 格式化電話顯示（添加空格便於閱讀）
 * HK: 9123 4567
 * Mainland: 138 0013 8000
 */
export function formatPhoneDisplay(phone: string, region?: Region): string {
  const cleaned = cleanPhone(phone)
  
  // 自動判斷地區
  if (!region) {
    if (cleaned.length === 8) region = 'hk'
    else if (cleaned.length === 11) region = 'mainland'
    else return cleaned
  }
  
  if (region === 'hk') {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`
  } else {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7)}`
  }
}
