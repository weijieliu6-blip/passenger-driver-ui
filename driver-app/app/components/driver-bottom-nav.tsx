'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Inbox, BarChart3, Calendar, AlertCircle, LogOut
} from 'lucide-react'

const ITEMS = [
  { href: '/driver/orders',  label: '訂單',   Icon: Inbox },
  { href: '/driver/reports', label: '報表',   Icon: BarChart3 },
  { href: '/driver/schedule',label: '出車時間', Icon: Calendar },
]

export function DriverBottomNav() {
  const pathname = usePathname() || ''
  const router = useRouter()
  const [hideForAuth, setHideForAuth] = useState(true)

  useEffect(() => {
    let mounted = true
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (!mounted) return
        setHideForAuth(!d?.authenticated || d?.user?.role !== 'driver')
      })
      .catch(() => setHideForAuth(true))
    return () => { mounted = false }
  }, [pathname])

  const handleLogout = async () => {
    if (!confirm('確定要登出嗎？')) return
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/driver/login')
  }

  // 在登入頁不顯示
  if (pathname.startsWith('/driver/login')) return null
  if (hideForAuth) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur border-t border-slate-700/50">
      <div className="max-w-5xl mx-auto px-2 py-1 grid grid-cols-4">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg text-xs transition ${
                active
                  ? 'text-amber-300 bg-amber-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </Link>
          )
        })}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg text-xs text-slate-400 hover:text-red-400 transition"
        >
          <LogOut className="w-5 h-5" />
          <span>登出</span>
        </button>
      </div>
    </nav>
  )
}
