'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  User, Phone, Mail, Car, ShieldCheck, Star, Clock,
  Wallet, TrendingUp, ChevronRight, AlertCircle, CheckCircle,
  Sparkles, MapPin, FileText
} from 'lucide-react'

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

const CAR_TYPES: { value: CarType; label: string; emoji: string; desc: string }[] = [
  { value: 'sedan_5', label: '5 座豐田 Camry', emoji: '🚗', desc: '日常通勤 / 小家庭首選' },
  { value: 'alphard_7', label: '7 座埃爾法', emoji: '🚙', desc: '商務 / 多人行李首選' },
  { value: 'business_9', label: '9 座商務車', emoji: '🚐', desc: '團體 / 大行李首選' },
]

const BENEFITS = [
  { icon: Wallet, title: '月入穩定', desc: '平台直派單，無中間抽成壓力' },
  { icon: Clock, title: '時間彈性', desc: '24 小時可搶單，自由安排出車時間' },
  { icon: TrendingUp, title: '收入透明', desc: '完成訂單越多，獎金 / 評分加成' },
  { icon: ShieldCheck, title: '平台擔保', desc: '糾紛處理 + 旅客聯繫平台居中協調' },
]

export default function DriverRecruitPage() {
  const router = useRouter()
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
    if (!form.name.trim()) return setError('請填寫姓名')
    if (!form.phone.trim()) return setError('請填寫聯絡電話')
    if (!form.plate.trim()) return setError('請填寫車牌號碼')
    if (!form.drivingYears || +form.drivingYears < 3) {
      return setError('駕齡至少 3 年（含跨境經驗者優先）')
    }
    const phoneClean = form.phone.replace(/[\s-+]/g, '')
    if (!/^(\+?852\d{8}|\+?861[3-9]\d{9}|852\d{8}|1[3-9]\d{9})$/.test(phoneClean)) {
      return setError('電話格式不正確（+852 香港 / +86 內地）')
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
        setError(data.error || '提交失敗，請稍後重試')
        return
      }
      setSuccess(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err instanceof Error ? err.message : '網絡錯誤，請稍後重試')
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
          <h1 className="text-2xl font-bold text-amber-300 mb-3">申請已收到！</h1>
          <p className="text-slate-300 mb-2">
            我們已記錄您提交的司機資料：
          </p>
          <div className="bg-slate-900/50 rounded-2xl p-4 my-6 text-left text-sm text-slate-200">
            <div className="grid grid-cols-2 gap-2">
              <div className="text-slate-500">姓名</div>
              <div className="font-medium">{form.name}</div>
              <div className="text-slate-500">電話</div>
              <div className="font-medium">{form.phone}</div>
              <div className="text-slate-500">車牌</div>
              <div className="font-medium">{form.plate}</div>
              <div className="text-slate-500">車型</div>
              <div className="font-medium">
                {CAR_TYPES.find(c => c.value === form.carType)?.label}
              </div>
            </div>
          </div>
          <p className="text-sm text-amber-300 mb-6">
            📞 我們會在 24 小時內致電 <span className="font-bold">{form.phone}</span> 核對資料並安排培訓。
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-slate-700 hover:bg-slate-600 text-slate-100 py-3 rounded-xl font-medium transition"
          >
            返回主頁
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-900/20 via-slate-900 to-slate-900">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent" />
        <div className="max-w-3xl mx-auto px-4 pt-12 pb-8 relative">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-500/20 border border-amber-500/30 rounded-full text-xs text-amber-300 mb-6">
              <Sparkles className="w-3 h-3" />
              司機招募進行中
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-slate-50 mb-3">
              🚖 加入中港車預約平台
            </h1>
            <p className="text-base md:text-lg text-slate-400">
              跨境專車司機招募中 — 接單自由、多勞多得
            </p>
          </div>

          {/* Benefits grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
            {BENEFITS.map(b => (
              <div key={b.title} className="bg-slate-800/60 backdrop-blur border border-slate-700 rounded-2xl p-4">
                <b.icon className="w-5 h-5 text-amber-400 mb-2" />
                <div className="text-sm font-bold text-slate-100 mb-1">{b.title}</div>
                <div className="text-xs text-slate-400 leading-relaxed">{b.desc}</div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-10 text-center">
            <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 rounded-2xl p-4">
              <div className="text-2xl md:text-3xl font-bold text-amber-300 mb-1">2hr</div>
              <div className="text-xs text-slate-400">平均回覆</div>
            </div>
            <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 rounded-2xl p-4">
              <div className="text-2xl md:text-3xl font-bold text-amber-300 mb-1">24h</div>
              <div className="text-xs text-slate-400">全時段搶單</div>
            </div>
            <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 rounded-2xl p-4">
              <div className="text-2xl md:text-3xl font-bold text-amber-300 mb-1">0%</div>
              <div className="text-xs text-slate-400">中間抽成</div>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 pb-16">
        <div className="bg-slate-800/70 backdrop-blur border border-amber-500/20 rounded-3xl p-6 md:p-8 shadow-2xl shadow-amber-500/10">
          <h2 className="text-xl font-bold text-amber-300 mb-1">📋 司機資料登記</h2>
          <p className="text-sm text-slate-400 mb-6">
            填妥後我們將於 24 小時內聯繫您，補完跨境證件審核即可正式搶單。
          </p>

          {error && (
            <div className="mb-5 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-300">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 姓名 */}
            <Field label="姓名 / 暱稱" icon={User} required>
              <input
                value={form.name}
                onChange={e => update('name', e.target.value)}
                placeholder="例如：陳先生 / 偉師傅"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </Field>

            {/* 電話 */}
            <Field label="聯絡電話（含區號）" icon={Phone} required>
              <input
                value={form.phone}
                onChange={e => update('phone', e.target.value)}
                placeholder="+852 9123 4567 / +86 138 0013 8000"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </Field>

            {/* Email */}
            <Field label="電郵（選填）" icon={Mail}>
              <input
                type="email"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                placeholder="example@email.com"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </Field>

            {/* 車型 */}
            <Field label="主要車型（單選）" icon={Car} required>
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
                    <div className="text-sm font-bold">{c.label}</div>
                    <div className="text-xs opacity-70">{c.desc}</div>
                  </button>
                ))}
              </div>
            </Field>

            {/* 車牌 + 駕齡 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="車牌號碼" icon={Car} required>
                <input
                  value={form.plate}
                  onChange={e => update('plate', e.target.value.toUpperCase())}
                  placeholder="例如：HK 1234 / 粤 B 12345"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase"
                />
              </Field>
              <Field label="駕齡（年）" icon={Clock} required>
                <input
                  type="number"
                  min={3}
                  max={50}
                  value={form.drivingYears}
                  onChange={e => update('drivingYears', e.target.value)}
                  placeholder="例如：5"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </Field>
            </div>

            {/* 常駐地 */}
            <Field label="常駐城市（選填）" icon={MapPin}>
              <input
                value={form.city}
                onChange={e => update('city', e.target.value)}
                placeholder="例如：香港 / 深圳"
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
                  已持有跨境運輸證件
                </div>
                <div className="text-slate-400 text-xs mt-1 leading-relaxed">
                  包括「中港車牌」、「粵港澳直通車牌」、「CIK 證」或相關運輸許可
                </div>
              </div>
            </label>

            {/* 備註 */}
            <Field label="其他備註（選填）" icon={FileText}>
              <textarea
                value={form.message}
                onChange={e => update('message', e.target.value)}
                placeholder="例如：可出車時段、語言能力、過往跨境經驗..."
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
                <>處理中...</>
              ) : (
                <>
                  提交申請
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>

            <p className="text-xs text-slate-500 text-center">
              提交即同意我們聯繫您核對資料並安排後續培訓
            </p>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-3 text-xs text-slate-500">
            <span>🚖 中港車預約平台</span>
            <span>·</span>
            <span>客服 <a href="tel:+85200000000" className="text-amber-400 hover:text-amber-300">+852</a></span>
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
