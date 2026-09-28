import type { ReactNode } from 'react'
import { DriverBottomNav } from '../components/driver-bottom-nav'

/**
 * /driver/* 路由的 layout — 提供全螢幕底部導覽列。
 * 注意：status switcher 是放在各頁面 header 內（每頁 header 不同），
 * 這裡只掛底部導覽，確保「訂單 / 報表 / 出車時間」三個入口始終可見。
 */
export default function DriverLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen pb-20">
      {children}
      <DriverBottomNav />
    </div>
  )
}
