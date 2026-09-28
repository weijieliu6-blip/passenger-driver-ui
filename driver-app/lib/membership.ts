import { MembershipTier } from './supabase'

/**
 * 計算訂單對特定司機的顯示延遲時間（秒）
 * 黃金 0秒 | 白金 60秒 | 普通 120秒 | 非會員 不推送
 */
export function shouldShowOrder(
  membershipTier: MembershipTier,
  goldReleasedAt: string | null,
  platinumReleasedAt: string | null,
  normalReleasedAt: string | null
): boolean {
  const now = new Date()

  let releasedAt: Date | null = null
  switch (membershipTier) {
    case 'gold':
      releasedAt = goldReleasedAt ? new Date(goldReleasedAt) : null
      break
    case 'platinum':
      releasedAt = platinumReleasedAt ? new Date(platinumReleasedAt) : null
      break
    case 'normal':
      releasedAt = normalReleasedAt ? new Date(normalReleasedAt) : null
      break
    case 'none':
      return false // 非會員只走釘釘
  }

  if (!releasedAt) return false
  return now.getTime() >= releasedAt.getTime()
}

/**
 * 獲取會員等級對應的延遲秒數
 */
export function getDelaySeconds(tier: MembershipTier): number {
  switch (tier) {
    case 'gold': return 0
    case 'platinum': return 60
    case 'normal': return 120
    case 'none': return -1 // -1 表示不推送
    default: return 120
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
    default: return '未知'
  }
}

/**
 * 獲取會員等級的特權描述
 */
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

/**
 * 獲取會員等級對應的顏色（用於 UI 顯示）
 */
export function getMembershipColor(tier: MembershipTier): string {
  switch (tier) {
    case 'gold': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
    case 'platinum': return 'text-purple-400 bg-purple-500/10 border-purple-500/30'
    case 'normal': return 'text-slate-400 bg-slate-500/10 border-slate-500/30'
    case 'none': return 'text-red-400 bg-red-500/10 border-red-500/30'
    default: return 'text-slate-400'
  }
}

/**
 * 獲取會員等級對應的月費價格（港幣）
 */
export function getMembershipPrice(tier: MembershipTier): number {
  switch (tier) {
    case 'gold': return 999
    case 'platinum': return 299
    case 'normal': return 99
    case 'none': return 0
    default: return 0
  }
}
