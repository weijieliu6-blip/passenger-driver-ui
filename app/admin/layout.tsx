import Link from 'next/link'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { requireSSRAdmin } from '@/lib/auth-ssr'

/**
 * 後台 layout（SSR）
 * - 強制 admin 登入：未登入或非 admin → redirect 到 /passenger/login
 * - 真正的角色檢查由 requireSSRAdmin 完成；middleware/proxy 也會擋，
 *   此處是第二道防線（防 middleware matcher 漏配或被繞過）。
 */
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // 未登入或非 admin 會被 redirect；這個 await 必須執行
  await requireSSRAdmin('/admin/orders')

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-bold">後台管理</h1>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/admin/orders" className="text-slate-300 hover:text-cyan-400">
                訂單列表
              </Link>
              <Link href="/admin/drivers" className="text-slate-300 hover:text-cyan-400">
                司機列表
              </Link>
              <Link href="/admin/applications" className="text-slate-300 hover:text-cyan-400">
                招募申請
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <LocaleSwitcher compact />
            <Link href="/" className="text-xs text-slate-400 hover:text-slate-200">
              ← 返回前台
            </Link>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
