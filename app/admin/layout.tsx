import Link from 'next/link'

/**
 * 後台最小版 layout（簡單 top nav）
 * 不做權限登入；先假設 admin 直接進得去
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
          <Link href="/" className="text-xs text-slate-400 hover:text-slate-200">
            ← 返回前台
          </Link>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}