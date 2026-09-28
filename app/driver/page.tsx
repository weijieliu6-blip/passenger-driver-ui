'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  User, Phone, Mail, Car, ShieldCheck, Star, Clock,
  Wallet, TrendingUp, ChevronRight, AlertCircle, CheckCircle,
  Sparkles, MapPin, FileText, Globe
} from 'lucide-react'
import { useT } from '@/components/i18n-provider'
import { LocaleSwitcher } from '@/components/locale-switcher'

/**
 * 司機招募頁 — /driver
 *
 * 流程：
 * 1) 司機填寫姓名、電話、車牌、車型、年駕齡
 * 2) 提交後等待我們補完跨境證件查核
 * 3) 通過即可正式接收釘釘搶單訊息
 *
 * （目前為 v1 簡化版：申請表單 + 收集司機基本資料 → 我們後台人工審核）
 */

type CarType = 'sedan_5' | 'alphard_7' | 'business_9'

const CAR_TYPES: { value: CarType; labelKey: string; emoji: string; descKey: string }[] = [
  { value: 'sedan_5', labelKey: 'car.sedan_5', emoji: '🚗', descKey: 'recruit.car.sedan.desc' },
  { value: 'alphard_7', labelKey: 'car.alphard_7', emoji: '🚙', descKey: 'recruit.car.alphard.desc' },
  { value: 'business_9', labelKey: 'car.business_9', emoji: '🚐', descKey: 'recruit.car.business.desc' },
]

const BENEFIT_KEYS = [
  { icon: Wallet, titleKey: 'recruit.benefit.income.title', descKey: 'recruit.benefit.income.desc' },
  { icon: Clock, titleKey: 'recruit.benefit.flex.title', descKey: 'recruit.benefit.flex.desc' },
  { icon: TrendingUp, titleKey: 'recruit.benefit.trans.title', descKey: 'recruit.benefit.trans.desc' },
  { icon: ShieldCheck, titleKey: 'recruit.benefit.safe.title', descKey: 'recruit.benefit.safe.desc' },
] as const

export default function DriverRecruitPage() {
  const router = useRouter()
  const t = useT()
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    plate: '',
    carType: 'alphard_7' as CarType,
    drivingYears: '',
    hasCrossBorderPermit: false,
    city: '',
    message: '',
  })

  function update<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // 基本驗證
    if (!form.name.trim()) return setError(t('recruit.error.name'))
    if (!form.phone.trim()) return setError(t('recruit.error.phone'))
    if (!form.plate.trim()) return setError(t('recruit.error.plate'))
    if (!form.drivingYears || +form.drivingYears < 3) {
      return setError(t('recruit.error.years'))
    }
    const phoneClean = form.phone.replace(/[\s-+]/g, '')
    if (!/^(\+?852\d{8}|\+?861[3-9]\d{9}|852\d{8}|1[3-9]\d{9})$/.test(phoneClean)) {
      return setError(t('recruit.error.phone_fmt'))
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/driver-recruit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          plate: form.plate.trim(),
          carType: form.carType,
          drivingYears: Number(form.drivingYears),
          city: form.city.trim() || undefined,
          hasCrossBorderPermit: form.hasCrossBorderPermit,
          message: form.message.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || t('recruit.error.generic'))
        return
      }
      setSuccess(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('recruit.error.network'))
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-900/20 via-slate-900 to-slate-900 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-slate-800/80 backdrop-blur border border-amber-500/30 rounded-3xl p-8 shadow-2xl shadow-amber-500/10 text-center">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-amber-300 mb-3">{t('recruit.success')}</h1>
          <p className="text-slate-300 mb-2">
            {t('recruit.success.note')}
          </p>
          <div className="bg-slate-900/50 rounded-2xl p-4 my-6 text-left text-sm text-slate-200">
            <div className="grid grid-cols-2 gap-2">
              <div className="text-slate-500">{t('recruit.success.field.name')}</div>
              <div className="font-medium">{form.name}</div>
              <div className="text-slate-500">{t('recruit.success.field.phone')}</div>
              <div className="font-medium">{form.phone}</div>
              <div className="text-slate-500">{t('recruit.success.field.plate')}</div>
              <div className="font-medium">{form.plate}</div>
              <div className="text-slate-500">{t('recruit.success.field.car')}</div>
              <div className="font-medium">
                {t(CAR_TYPES.find(c => c.value === form.carType)?.labelKey ?? 'car.alphard_7')}
              </div>
            </div>
          </div>
          <p className="text-sm text-amber-300 mb-6">
            {t('recruit.success.call')} <span className="font-bold">{form.phone}</span>
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-slate-700 hover:bg-slate-600 text-slate-100 py-3 rounded-xl font-medium transition"
          >
            {t('recruit.back_home')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-900/20 via-slate-900 to-slate-900">
      {/* 頂部語言切換 */}
      <div className="absolute top-4 right-4 z-30">
        <LocaleSwitcher />
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent" />
        <div className="max-w-3xl mx-auto px-4 pt-12 pb-8 relative">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-500/20 border border-amber-500/30 rounded-full text-xs text-amber-300 mb-6">
              <Sparkles className="w-3 h-3" />
              {t('recruit.badge')}
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-slate-50 mb-3">
              🚖 {t('recruit.title')}
            </h1>
            <p className="text-base md:text-lg text-slate-400">
              {t('recruit.subtitle')}
            </p>
          </div>

          {/* Benefits grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
            {BENEFIT_KEYS.map(b => (
              <div key={b.titleKey} className="bg-slate-800/60 backdrop-blur border border-slate-700 rounded-2xl p-4">
                <b.icon className="w-5 h-5 text-amber-400 mb-2" />
                <div className="text-sm font-bold text-slate-100 mb-1">{t(b.titleKey)}</div>
                <div className="text-xs text-slate-400 leading-relaxed">{t(b.descKey)}</div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-10 text-center">
            <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 rounded-2xl p-4">
              <div className="text-2xl md:text-3xl font-bold text-amber-300 mb-1">2hr</div>
              <div className="text-xs text-slate-400">{t('recruit.stat.reply')}</div>
            </div>
            <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 rounded-2xl p-4">
              <div className="text-2xl md:text-3xl font-bold text-amber-300 mb-1">24h</div>
              <div className="text-xs text-slate-400">{t('recruit.stat.247')}</div>
            </div>
            <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 rounded-2xl p-4">
              <div className="text-2xl md:text-3xl font-bold text-amber-300 mb-1">0%</div>
              <div className="text-xs text-slate-400">{t('recruit.stat.commission')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 pb-16">
        <div className="bg-slate-800/70 backdrop-blur border border-amber-500/20 rounded-3xl p-6 md:p-8 shadow-2xl shadow-amber-500/10">
          <h2 className="text-xl font-bold text-amber-300 mb-1">{t('recruit.form_title')}</h2>
          <p className="text-sm text-slate-400 mb-6">
            {t('recruit.form_subtitle')}
          </p>

          {error && (
            <div className="mb-5 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-300">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 姓名 */}
            <Field label={t('recruit.name')} icon={User} required>
              <input
                value={form.name}
                onChange={e => update('name', e.target.value)}
                placeholder={t('recruit.name.placeholder')}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </Field>

            {/* 電話 */}
            <Field label={t('recruit.phone')} icon={Phone} required>
              <input
                value={form.phone}
                onChange={e => update('phone', e.target.value)}
                placeholder={t('recruit.phone.placeholder')}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </Field>

            {/* Email */}
            <Field label={t('recruit.email')} icon={Mail}>
              <input
                type="email"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                placeholder="example@email.com"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </Field>

            {/* 車型 */}
            <Field label={t('recruit.car_type')} icon={Car} required>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {CAR_TYPES.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => update('carType', c.value)}
                    className={`text-left p-3 rounded-xl border transition ${
                      form.carType === c.value
                        ? 'bg-amber-500/20 border-amber-500/60 text-amber-100'
                        : 'bg-slate-900/50 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="text-lg mb-0.5">{c.emoji}</div>
                    <div className="text-sm font-bold">{t(c.labelKey)}</div>
                    <div className="text-xs opacity-70">{t(c.descKey)}</div>
                  </button>
                ))}
              </div>
            </Field>

            {/* 車牌 + 駕齡 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={t('recruit.plate')} icon={Car} required>
                <input
                  value={form.plate}
                  onChange={e => update('plate', e.target.value.toUpperCase())}
                  placeholder={t('recruit.plate.placeholder')}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase"
                />
              </Field>
              <Field label={t('recruit.years')} icon={Clock} required>
                <input
                  type="number"
                  min={3}
                  max={50}
                  value={form.drivingYears}
                  onChange={e => update('drivingYears', e.target.value)}
                  placeholder={t('recruit.years.placeholder')}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </Field>
            </div>

            {/* 常駐地 */}
            <Field label={t('recruit.city')} icon={MapPin}>
              <input
                value={form.city}
                onChange={e => update('city', e.target.value)}
                placeholder={t('recruit.city.placeholder')}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </Field>

            {/* 跨境證件 */}
            <label className="flex items-start gap-3 p-4 bg-slate-900/30 border border-slate-700 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={form.hasCrossBorderPermit}
                onChange={e => update('hasCrossBorderPermit', e.target.checked)}
                className="mt-1 w-4 h-4 accent-amber-500"
              />
              <div className="flex-1 text-sm">
                <div className="flex items-center gap-1 text-slate-100 font-medium">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  {t('recruit.permit')}
                </div>
                <div className="text-slate-400 text-xs mt-1 leading-relaxed">
                  {t('recruit.permit.desc')}
                </div>
              </div>
            </label>

            {/* 備註 */}
            <Field label={t('recruit.message')} icon={FileText}>
              <textarea
                value={form.message}
                onChange={e => update('message', e.target.value)}
                placeholder={t('recruit.message.placeholder')}
                rows={3}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              />
            </Field>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-bold text-lg py-4 px-6 rounded-xl hover:from-amber-400 hover:to-orange-400 focus:outline-none focus:ring-4 focus:ring-amber-500/50 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>{t('btn.loading')}</>
              ) : (
                <>
                  {t('recruit.submit')}
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>

            <p className="text-xs text-slate-500 text-center">
              {t('recruit.consent')}
            </p>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-3 text-xs text-slate-500">
            <span>🚖 {t('recruit.footer.brand')}</span>
            <span>·</span>
            <span>{t('recruit.footer.cs')} <a href="tel:+85200000000" className="text-amber-400 hover:text-amber-300">+852</a></span>
            <span>·</span>
            <span>v1.0</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  icon: Icon,
  required = false,
  children,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-2">
        <Icon className="inline w-4 h-4 mr-1" />
        {label}
        {required && <span className="text-amber-400 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}
