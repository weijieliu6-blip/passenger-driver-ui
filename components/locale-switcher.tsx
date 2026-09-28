'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Globe, Check } from 'lucide-react'
import { useLocale } from './i18n-provider'
import { LOCALES, LOCALE_LABEL, LOCALE_FLAG, type Locale } from '@/lib/i18n'

export function LocaleSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useLocale()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // 點外面關閉
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition ${
          compact
            ? 'bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-800'
            : 'bg-slate-900/50 border border-slate-600 text-slate-100 hover:border-slate-500'
        }`}
      >
        <Globe className="w-3.5 h-3.5" />
        <span>{LOCALE_FLAG[locale]}</span>
        {!compact && <span className="font-medium">{LOCALE_LABEL[locale]}</span>}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-50 overflow-hidden">
          {LOCALES.map(l => (
            <button
              key={l}
              type="button"
              onClick={() => {
                setLocale(l)
                setOpen(false)
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-700 transition ${
                locale === l ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-200'
              }`}
            >
              <span className="text-base">{LOCALE_FLAG[l]}</span>
              <span className="font-medium">{LOCALE_LABEL[l]}</span>
              {locale === l && <Check className="w-3.5 h-3.5 ml-auto text-cyan-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
