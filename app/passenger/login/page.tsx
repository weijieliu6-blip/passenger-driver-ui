'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { User, Mail, Lock, Phone, AlertCircle, CheckCircle, ChevronDown } from 'lucide-react'

type Mode = 'login' | 'register'
type RegMethod = 'email' | 'phone'
type Region = 'hk' | 'mainland'

const REGIONS = [
  { code: 'hk' as Region, label: '+852', name: '香港', flag: '🇭🇰' },
  { code: 'mainland' as Region, label: '+86', name: '內地', flag: '🇨🇳' },
]

// 校驗函數
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

// 格式化電話顯示
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

// 自動判斷輸入的地區
function detectRegion(input: string): Region | null {
  const cleaned = input.replace(/[\s-+()]/g, '')
  // 帶前綴
  if (cleaned.startsWith('852')) return 'hk'
  if (cleaned.startsWith('86') && cleaned.length >= 3) return 'mainland'
  // 純號碼判斷
  if (/^[5689]\d{7}$/.test(cleaned)) return 'hk'
  if (/^1[3-9]\d{9}$/.test(cleaned)) return 'mainland'
  return null
}

// 判斷輸入是電郵還是電話
function detectInputType(input: string): 'email' | 'phone' {
  if (input.includes('@')) return 'email'
  return 'phone'
}

export default function PassengerLoginPage() {
  return (
    <Suspense fallback={null}>
      <PassengerLoginForm />
    </Suspense>
  )
}

function PassengerLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/passenger/profile'
  
  const [mode, setMode] = useState<Mode>('login')
  const [regMethod, setRegMethod] = useState<RegMethod>('phone')
  const [region, setRegion] = useState<Region>('hk') // 註冊時的區號
  const [regionDropdownOpen, setRegionDropdownOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // 表單字段
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
        // 如果有待恢復的訂單數據，先恢復再跳轉
        if (typeof window !== 'undefined' && sessionStorage.getItem('pendingBooking')) {
          const pending = sessionStorage.getItem('pendingBooking')
          if (pending) {
            localStorage.setItem('bookingData', pending)
            sessionStorage.removeItem('pendingBooking')
          }
          router.push('/')
          return
        }
        router.push(redirectTo)
      }
    } catch (err) {
      console.error('Check auth error:', err)
    }
  }

  // 電話格式即時校驗
  const handlePhoneChange = (value: string) => {
    const cleaned = value.replace(/[\s-+()]/g, '')
    setPhone(cleaned)
    
    if (cleaned) {
      const result = validatePhone(cleaned, region)
      if (!result.valid) {
        setPhoneError(result.error || '電話格式錯誤')
      } else {
        setPhoneError('')
      }
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
        body = {
          identifier,
          password,
        }
      } else {
        body = {
          method: regMethod,
          password,
          name
        }
        if (regMethod === 'email') {
          body.email = email
        } else {
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
        setSuccess(data.message || (mode === 'login' ? '登入成功！' : '註冊成功！'))
        setTimeout(() => {
          // 如果有未完成的訂單表單數據，從 sessionStorage 恢復到 localStorage 並跳回首頁
          if (typeof window !== 'undefined' && sessionStorage.getItem('pendingBooking')) {
            const pending = sessionStorage.getItem('pendingBooking')
            if (pending) {
              localStorage.setItem('bookingData', pending)
              sessionStorage.removeItem('pendingBooking')
            }
            router.push('/')
            router.refresh()
            return
          }
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* 返回首頁 */}
        <div className="mb-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm">
            ← 返回首頁
          </Link>
        </div>
        
        {/* 卡片 */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 shadow-xl">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-2xl mb-4">
              <User className="w-8 h-8 text-slate-900" />
            </div>
            <h1 className="text-2xl font-bold text-slate-50 mb-1">
              {mode === 'login' ? '乘客登入' : '乘客註冊'}
            </h1>
            <p className="text-sm text-slate-400">
              {mode === 'login' ? '使用電郵或手機號碼登入' : '選擇電郵或手機號碼註冊'}
            </p>
          </div>
          
          {/* 模式切換 */}
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
                  ? 'bg-cyan-500 text-slate-900'
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
                  ? 'bg-cyan-500 text-slate-900'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              註冊
            </button>
          </div>
          
          {/* 提示信息 */}
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
          
          {/* 表單 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 註冊時顯示姓名 */}
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
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                />
              </div>
            )}
            
            {/* 登入模式：智能識別電郵或電話 */}
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
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
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
            
            {/* 註冊模式：選擇電郵或電話 */}
            {mode === 'register' && (
              <>
                {/* 切換電郵/手機 */}
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
                        ? 'bg-teal-500 text-slate-900'
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
                        ? 'bg-teal-500 text-slate-900'
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
                      className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                    />
                  </div>
                ) : (
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-slate-300 mb-2">
                      <Phone className="inline w-4 h-4 mr-1" />
                      手機號碼
                    </label>
                    
                    {/* 區號選擇器 + 電話輸入 */}
                    <div className="flex gap-2">
                      {/* 區號下拉框 */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setRegionDropdownOpen(!regionDropdownOpen)}
                          onBlur={() => setTimeout(() => setRegionDropdownOpen(false), 200)}
                          className="flex items-center gap-1 px-3 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 hover:bg-slate-900/70 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition min-w-[90px]"
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
                                  // 重新校驗當前輸入
                                  if (phone) {
                                    const result = validatePhone(phone, r.code)
                                    setPhoneError(result.valid ? '' : (result.error || '電話格式錯誤'))
                                  }
                                }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-700 transition ${
                                  region === r.code ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-200'
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
                      
                      {/* 電話號碼輸入 */}
                      <input
                        id="phone"
                        type="tel"
                        value={phone ? formatPhoneDisplay(phone, region) : ''}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        placeholder={region === 'hk' ? '9123 4567' : '138 0013 8000'}
                        className={`flex-1 px-4 py-3 bg-slate-900/50 border rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 transition ${
                          phoneError
                            ? 'border-red-500 focus:ring-red-500'
                            : 'border-slate-600 focus:ring-cyan-500 focus:border-transparent'
                        }`}
                      />
                    </div>
                    
                    {phoneError && (
                      <p className="text-xs text-red-400 mt-1">{phoneError}</p>
                    )}
                    <p className="text-xs text-slate-500 mt-1">
                      {region === 'hk' 
                        ? '🇭🇰 香港：8位數字，以 5/6/7/8/9 開頭' 
                        : '🇨🇳 內地：11位數字，以 1[3-9] 開頭'}
                    </p>
                  </div>
                )}
              </>
            )}
            
            {/* 密碼 */}
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
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
              />
            </div>
            
            {/* 提交按鈕 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-900 font-bold text-lg py-3 px-6 rounded-xl hover:from-cyan-400 hover:to-teal-400 focus:outline-none focus:ring-4 focus:ring-cyan-500/50 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '處理中...' : (mode === 'login' ? '登入' : (regMethod === 'phone' ? '使用手機號碼註冊' : '使用電郵註冊'))}
            </button>
          </form>
          
          {/* 提示 */}
          <div className="mt-6 text-center">
            <p className="text-xs text-slate-500">
              {mode === 'login' ? (
                <>
                  還沒有帳號？{' '}
                  <button
                    type="button"
                    onClick={() => setMode('register')}
                    className="text-cyan-400 hover:text-cyan-300"
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
                    className="text-cyan-400 hover:text-cyan-300"
                  >
                    立即登入
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
        
        {/* 底部說明 */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            註冊帳號後，您可以在「我的訂單」查看所有歷史訂單，無需每次輸入電話號碼。
          </p>
        </div>
      </div>
    </div>
  )
}
