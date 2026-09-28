'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { User, Mail, Lock, Phone, AlertCircle, CheckCircle, ChevronDown } from 'lucide-react'

type Mode = 'login' | 'register'
type RegMethod = 'email' | 'phone'
type Region = 'hk' | 'mainland'

const REGIONS = [
  { code: 'hk' as Region, label: '+852', name: '香港', flag: '🇭🇰' },
  { code: 'mainland' as Region, label: '+86', name: '內地', flag: '🇨🇳' },
]

function validatePhone(phone: string, region: Region): { valid: boolean; error?: string } {
  const cleaned = phone.replace(/[\s-+()]/g, '')
  if (region === 'hk') {
    if (!/^[5689]\d{7}$/.test(cleaned)) {
      return { valid: false, error: '香港手機號應為8位數字，以5/6/7/8/9開頭' }
    }
  } else {
    if (!/^1[3-9]\d{9}$/.test(cleaned)) {
      return { valid: false, error: '內地手機號應為11位數字，以1[3-9]開頭' }
    }
  }
  return { valid: true }
}

function formatPhoneDisplay(phone: string, region: Region): string {
  const cleaned = phone.replace(/[\s-+()]/g, '')
  if (region === 'hk') {
    return cleaned.length >= 4 ? `${cleaned.slice(0, 4)} ${cleaned.slice(4)}` : cleaned
  } else {
    if (cleaned.length <= 3) return cleaned
    if (cleaned.length <= 7) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7)}`
  }
}

function detectRegion(input: string): Region | null {
  const cleaned = input.replace(/[\s-+()]/g, '')
  if (cleaned.startsWith('852')) return 'hk'
  if (cleaned.startsWith('86') && cleaned.length >= 3) return 'mainland'
  if (/^[5689]\d{7}$/.test(cleaned)) return 'hk'
  if (/^1[3-9]\d{9}$/.test(cleaned)) return 'mainland'
  return null
}

function detectInputType(input: string): 'email' | 'phone' {
  if (input.includes('@')) return 'email'
  return 'phone'
}

export default function DriverLoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/driver/dashboard'

  const [mode, setMode] = useState<Mode>('login')
  const [regMethod, setRegMethod] = useState<RegMethod>('phone')
  const [region, setRegion] = useState<Region>('hk')
  const [regionDropdownOpen, setRegionDropdownOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [identifier, setIdentifier] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phoneError, setPhoneError] = useState('')

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me')
      const data = await response.json()
      if (data.authenticated) {
        router.push(redirectTo)
      }
    } catch (err) {
      console.error('Check auth error:', err)
    }
  }

  const handlePhoneChange = (value: string) => {
    const cleaned = value.replace(/[\s-+()]/g, '')
    setPhone(cleaned)
    if (cleaned) {
      const result = validatePhone(cleaned, region)
      if (!result.valid) setPhoneError(result.error || '電話格式錯誤')
      else setPhoneError('')
    } else {
      setPhoneError('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (mode === 'login') {
      if (!identifier || !password) {
        setError('請填寫電郵/電話和密碼')
        return
      }
    } else {
      if (!password || !name) {
        setError('請填寫姓名和密碼')
        return
      }
      if (regMethod === 'email') {
        if (!email) {
          setError('請填寫電郵')
          return
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
          setError('請輸入有效的電郵地址')
          return
        }
      } else {
        if (!phone) {
          setError('請填寫手機號碼')
          return
        }
        const result = validatePhone(phone, region)
        if (!result.valid) {
          setError(result.error || '電話格式錯誤')
          return
        }
      }
    }

    if (password.length < 6) {
      setError('密碼至少需要 6 個字符')
      return
    }

    setLoading(true)

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'

      let body: any
      if (mode === 'login') {
        body = { identifier, password }
      } else {
        body = {
          method: regMethod,
          password,
          name,
          role: 'driver',
        }
        if (regMethod === 'email') body.email = email
        else {
          body.phone = phone
          body.region = region
        }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (data.success) {
        if (data.user?.role !== 'driver') {
          setError('此帳號不是司機帳號，請使用司機帳號登入')
          return
        }
        setSuccess(data.message || (mode === 'login' ? '登入成功！' : '註冊成功！'))
        setTimeout(() => {
          router.push(redirectTo)
          router.refresh()
        }, 800)
      } else {
        setError(data.message || '操作失敗，請稍後重試')
      }
    } catch (err: any) {
      setError(err.message || '網絡錯誤，請稍後重試')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-amber-900/30 to-slate-900 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-slate-800/50 backdrop-blur border border-amber-500/20 rounded-2xl p-8 shadow-xl shadow-amber-500/10">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl mb-4">
              <User className="w-8 h-8 text-slate-900" />
            </div>
            <h1 className="text-2xl font-bold text-slate-50 mb-1">
              {mode === 'login' ? '司機登入' : '司機註冊'}
            </h1>
            <p className="text-sm text-slate-400">
              {mode === 'login' ? '使用電郵或手機號碼登入' : '選擇電郵或手機號碼註冊'}
            </p>
          </div>

          <div className="flex bg-slate-900/50 rounded-lg p-1 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login')
                setError('')
                setSuccess('')
                setPhoneError('')
              }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${
                mode === 'login'
                  ? 'bg-amber-500 text-slate-900'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              登入
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register')
                setError('')
                setSuccess('')
                setPhoneError('')
              }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${
                mode === 'register'
                  ? 'bg-amber-500 text-slate-900'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              註冊
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-300">{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-green-300">{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
                  <User className="inline w-4 h-4 mr-1" />
                  姓名
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="請輸入您的姓名"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                />
              </div>
            )}

            {mode === 'login' && (
              <div>
                <label htmlFor="identifier" className="block text-sm font-medium text-slate-300 mb-2">
                  {identifier.includes('@') ? (
                    <><Mail className="inline w-4 h-4 mr-1" />電郵地址</>
                  ) : (
                    <><Phone className="inline w-4 h-4 mr-1" />手機號碼（含區號）</>
                  )}
                </label>
                <div className="relative">
                  <input
                    id="identifier"
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="電郵或 +852/+86 手機號碼"
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                  />
                  {identifier && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">
                      {detectInputType(identifier) === 'email'
                        ? '📧 電郵'
                        : (() => {
                            const r = detectRegion(identifier)
                            if (r === 'hk') return '🇭🇰 香港'
                            if (r === 'mainland') return '🇨🇳 內地'
                            return '📱 手機'
                          })()}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  支持電郵、+852 香港號碼（8位）、+86 內地號碼（11位）
                </p>
              </div>
            )}

            {mode === 'register' && (
              <>
                <div className="flex bg-slate-900/50 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setRegMethod('phone')
                      setEmail('')
                      setError('')
                      setPhoneError('')
                    }}
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition flex items-center justify-center gap-1 ${
                      regMethod === 'phone'
                        ? 'bg-amber-500 text-slate-900'
                        : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    <Phone className="w-4 h-4" />
                    手機號碼
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRegMethod('email')
                      setPhone('')
                      setPhoneError('')
                      setError('')
                    }}
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition flex items-center justify-center gap-1 ${
                      regMethod === 'email'
                        ? 'bg-amber-500 text-slate-900'
                        : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    <Mail className="w-4 h-4" />
                    電郵
                  </button>
                </div>

                {regMethod === 'email' ? (
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                      <Mail className="inline w-4 h-4 mr-1" />
                      電郵地址
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="example@email.com"
                      className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                    />
                  </div>
                ) : (
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-slate-300 mb-2">
                      <Phone className="inline w-4 h-4 mr-1" />
                      手機號碼
                    </label>
                    <div className="flex gap-2">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setRegionDropdownOpen(!regionDropdownOpen)}
                          onBlur={() => setTimeout(() => setRegionDropdownOpen(false), 200)}
                          className="flex items-center gap-1 px-3 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 hover:bg-slate-900/70 focus:outline-none focus:ring-2 focus:ring-amber-500 transition min-w-[90px]"
                        >
                          <span>{REGIONS.find(r => r.code === region)?.flag}</span>
                          <span className="font-medium">{REGIONS.find(r => r.code === region)?.label}</span>
                          <ChevronDown className="w-3 h-3 text-slate-400" />
                        </button>
                        {regionDropdownOpen && (
                          <div className="absolute top-full left-0 mt-1 w-32 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-10 overflow-hidden">
                            {REGIONS.map(r => (
                              <button
                                key={r.code}
                                type="button"
                                onClick={() => {
                                  setRegion(r.code)
                                  setRegionDropdownOpen(false)
                                  if (phone) {
                                    const result = validatePhone(phone, r.code)
                                    setPhoneError(result.valid ? '' : (result.error || '電話格式錯誤'))
                                  }
                                }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-700 transition ${
                                  region === r.code ? 'bg-amber-500/20 text-amber-300' : 'text-slate-200'
                                }`}
                              >
                                <span>{r.flag}</span>
                                <span className="font-medium">{r.label}</span>
                                <span className="text-slate-400 text-xs ml-auto">{r.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <input
                        id="phone"
                        type="tel"
                        value={phone ? formatPhoneDisplay(phone, region) : ''}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        placeholder={region === 'hk' ? '9123 4567' : '138 0013 8000'}
                        className={`flex-1 px-4 py-3 bg-slate-900/50 border rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 transition ${
                          phoneError
                            ? 'border-red-500 focus:ring-red-500'
                            : 'border-slate-600 focus:ring-amber-500 focus:border-transparent'
                        }`}
                      />
                    </div>
                    {phoneError && <p className="text-xs text-red-400 mt-1">{phoneError}</p>}
                    <p className="text-xs text-slate-500 mt-1">
                      {region === 'hk'
                        ? '🇭🇰 香港：8位數字，以 5/6/7/8/9 開頭'
                        : '🇨🇳 內地：11位數字，以 1[3-9] 開頭'}
                    </p>
                  </div>
                )}
              </>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                <Lock className="inline w-4 h-4 mr-1" />
                密碼
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? '至少 6 個字符' : '請輸入密碼'}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-bold text-lg py-3 px-6 rounded-xl hover:from-amber-400 hover:to-orange-400 focus:outline-none focus:ring-4 focus:ring-amber-500/50 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '處理中...' : (mode === 'login' ? '司機登入' : '司機註冊')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-slate-500">
              {mode === 'login' ? (
                <>
                  還沒有司機帳號？{' '}
                  <button
                    type="button"
                    onClick={() => setMode('register')}
                    className="text-amber-400 hover:text-amber-300"
                  >
                    立即註冊
                  </button>
                </>
              ) : (
                <>
                  已有帳號？{' '}
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-amber-400 hover:text-amber-300"
                  >
                    立即登入
                  </button>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            註冊後請到「個人資料」完善車牌、車輛型號等信息
          </p>
          <p className="text-xs text-slate-600 mt-2">Driver Console · Port 3001</p>
        </div>
      </div>
    </div>
  )
}
