'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { DEFAULT_LOCALE, LOCALES, type Locale, t as translate, getDictionary } from '@/lib/i18n'

type TFunction = (key: string, fallback?: string) => string

interface I18nContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  t: TFunction
  dict: Record<string, string>
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children, initialLocale }: { children: ReactNode; initialLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE)
  const [dict, setDict] = useState<Record<string, string>>(() => getDictionary(initialLocale ?? DEFAULT_LOCALE))

  // 從 cookie 讀取初始 locale（僅 client side）
  useEffect(() => {
    const cookieLocale = document.cookie.match(/locale=([^;]+)/)?.[1]
    if (cookieLocale) {
      const decoded = decodeURIComponent(cookieLocale) as Locale
      if (LOCALES.includes(decoded) && decoded !== locale) {
        setLocaleState(decoded)
        setDict(getDictionary(decoded))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setLocale(l: Locale) {
    setLocaleState(l)
    setDict(getDictionary(l))
    // 寫入 cookie + 1 年有效期
    document.cookie = `locale=${encodeURIComponent(l)}; path=/; max-age=31536000; SameSite=Lax`
    // 通知其他 tab
    window.dispatchEvent(new Event('locale-changed'))
  }

  const t: TFunction = (key, fallback) => dict[key] ?? translate(locale, key, fallback)

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, dict }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useT(): TFunction {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    // fallback 為主頁（避免 SSR 報錯）
    return (key, fallback) => fallback ?? key
  }
  return ctx.t
}

export function useLocale(): { locale: Locale; setLocale: (l: Locale) => void } {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    return { locale: DEFAULT_LOCALE, setLocale: () => {} }
  }
  return { locale: ctx.locale, setLocale: ctx.setLocale }
}
