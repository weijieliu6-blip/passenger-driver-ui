'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import { useLocale } from './i18n-provider'
import { LOCALES, LOCALE_LABEL, LOCALE_FLAG, type Locale } from '@/lib/i18n'

export function LocaleSwitcher({
  compact = false,
  iconOnly = false,
}: {
  compact?: boolean
  iconOnly?: boolean
}) {
  const { locale, setLocale } = useLocale()
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; right: number }>({ top: 0, right: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // 點外面關閉
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      const target = e.target as Node
      if (
        menuRef.current?.contains(target) ||
        buttonRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler as any)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler as any)
    }
  }, [open])

  // 計算 dropdown 位置（基於 button 的 bounding rect）
  function openMenu() {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPosition({
        top: rect.bottom + window.scrollY + 4,
        right: window.innerWidth - rect.right,
      })
    }
    setOpen(true)
  }

  const dropdown = open && mounted ? (
    <div
      ref={menuRef}
      style={{ position: 'absolute', top: position.top, right: position.right }}
      className="min-w-[160px] bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-[9999] overflow-hidden"
    >
      {LOCALES.map(l => (
        <button
          key={l}
          type="button"
          onClick={() => {
            setLocale(l)
            setOpen(false)
          }}
          className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-slate-700 transition ${
            locale === l ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-200'
          }`}
        >
          <span className="text-lg">{LOCALE_FLAG[l]}</span>
          <span className="font-medium">{LOCALE_LABEL[l]}</span>
          {locale === l && <Check className="w-3.5 h-3.5 ml-auto text-cyan-400" />}
        </button>
      ))}
    </div>
  ) : null

  // Icon-only mode: 純圓形按鈕，只顯示當前語言國旗
  if (iconOnly) {
    return (
      <>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => (open ? setOpen(false) : openMenu())}
          aria-label={`Language: ${LOCALE_LABEL[locale]}`}
          title={LOCALE_LABEL[locale]}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-800/50 border border-slate-700 text-xl hover:bg-slate-800 hover:border-slate-500 transition-all"
        >
          <span>{LOCALE_FLAG[locale]}</span>
        </button>
        {mounted && createPortal(dropdown, document.body)}
      </>
    )
  }

  // 一般模式（向下相容）
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition ${
          compact
            ? 'bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-800'
            : 'bg-slate-900/50 border border-slate-600 text-slate-100 hover:border-slate-500'
        }`}
      >
        <span className="text-base">{LOCALE_FLAG[locale]}</span>
        {!compact && <span className="font-medium">{LOCALE_LABEL[locale]}</span>}
      </button>
      {mounted && createPortal(dropdown, document.body)}
    </>
  )
}
