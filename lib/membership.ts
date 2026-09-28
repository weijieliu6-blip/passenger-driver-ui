import { MembershipTier } from './supabase'

/**
 * 計算訂單對特定司機的顯示延遲時間（秒）
 * 
 * @param membershipTier 司機會員等級
 * @param orderCreatedAt 訂單創建時間
 * @returns 是否應該顯示該訂單
 */
export function shouldShowOrder(
  membershipTier: MembershipTier,
  orderCreatedAt: string
): boolean {
  const now = new Date()
  const createdAt = new Date(orderCreatedAt)
  const elapsedSeconds = (now.getTime() - createdAt.getTime()) / 1000

  // 根據會員等級決定延遲時間
  const delaySeconds = getDelaySeconds(membershipTier)
  
  return elapsedSeconds >= delaySeconds
}

/**
 * 獲取會員等級對應的延遲秒數
 */
export function getDelaySeconds(tier: MembershipTier): number {
  switch (tier) {
    case 'gold':
      return 0  // 立即顯示
    case 'platinum':
      return 60 // 60秒後顯示
    case 'normal':
      return 120 // 120秒後顯示
    case 'none':
      return -1 // -1 表示不推送
    default:
      return 120
  }
}

/**
 * 獲取會員等級的顯示名稱
 */
export function getMembershipTierLabel(tier: MembershipTier): string {
  switch (tier) {
    case 'gold': return '🥇 黃金會員'
    case 'platinum': return '💎 白金會員'
    case 'normal': return '🚗 普通會員'
    case 'none': return '❌ 非會員'
    default: return '未知會員'
  }
}

export function getMembershipBenefits(tier: MembershipTier): string[] {
  switch (tier) {
    case 'gold':
      return [
        '🔔 新訂單即時推送（0秒延遲）',
        '🥇 最優先搶單權',
        '📊 高級數據報表',
        '💬 專屬客服'
      ]
    case 'platinum':
      return [
        '⏱️ 新訂單延遲 60 秒推送',
        '✅ 可以搶單',
        '📊 基礎數據報表'
      ]
    case 'normal':
      return [
        '⏱️ 新訂單延遲 120 秒推送',
        '✅ 可以搶單',
        '🆓 免費會員'
      ]
    case 'none':
      return [
        '📵 不會收到站內推送',
        '💬 只能通過釘釘群搶單',
        '⚠️ 強烈建議升級會員'
      ]
    default:
      return []
  }
}

export function getMembershipPrice(tier: MembershipTier): number {
  switch (tier) {
    case 'gold': return 999
    case 'platinum': return 299
    case 'normal': return 99
    case 'none': return 0
    default: return 0
  }
}
