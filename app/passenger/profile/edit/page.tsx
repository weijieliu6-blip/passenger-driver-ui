'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { User, Phone, Mail, Camera, Save, ArrowLeft, Check } from 'lucide-react'

interface UserProfile {
  id: string
  name: string
  phone: string
  email: string
  avatar_url?: string
  role: string
}

export default function EditProfilePage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  
  const [nameError, setNameError] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      
      if (!data.authenticated) {
        router.push('/passenger/login?redirect=/passenger/profile/edit')
        return
      }
      
      setProfile(data.user)
      setName(data.user.name || '')
      setPhone(data.user.phone || '')
      setAvatarPreview(data.user.avatar_url || null)
    } catch (err) {
      console.error('Load profile error:', err)
      router.push('/passenger/login')
    } finally {
      setLoading(false)
    }
  }

  const validateForm = () => {
    let valid = true
    
    // 名字驗證
    if (!name.trim()) {
      setNameError('請輸入姓名')
      valid = false
    } else if (name.trim().length < 2) {
      setNameError('姓名至少需要2個字')
      valid = false
    } else {
      setNameError('')
    }
    
    // 電話驗證（香港/內地格式）
    const phoneRegex = /^[+]?[\d\s-]{8,15}$/
    if (!phone.trim()) {
      setPhoneError('請輸入電話號碼')
      valid = false
    } else if (!phoneRegex.test(phone.trim())) {
      setPhoneError('電話格式不正確')
      valid = false
    } else {
      setPhoneError('')
    }
    
    return valid
  }

  const handleSave = async () => {
    if (!validateForm()) return
    
    setSaving(true)
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() })
      })
      
      const data = await res.json()
      
      if (data.success) {
        setSaveSuccess(true)
        setTimeout(() => {
          router.push('/passenger/profile')
        }, 1500)
      } else {
        alert(data.error || '保存失敗，請稍後重試')
      }
    } catch (err) {
      console.error('Save profile error:', err)
      alert('保存失敗，請稍後重試')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // 客戶端預覽
    const reader = new FileReader()
    reader.onload = (ev) => {
      setAvatarPreview(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
    
    // 上傳頭像
    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('avatar', file)
      
      const res = await fetch('/api/auth/avatar', {
        method: 'POST',
        body: formData
      })
      
      const data = await res.json()
      
      if (data.success) {
        setAvatarPreview(data.avatar_url)
      } else {
        alert(data.error || '上傳頭像失敗')
        // 恢復原頭像
        setAvatarPreview(profile?.avatar_url || null)
      }
    } catch (err) {
      console.error('Upload avatar error:', err)
      alert('上傳頭像失敗')
      setAvatarPreview(profile?.avatar_url || null)
    } finally {
      setUploadingAvatar(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">載入中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/passenger/profile" className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300">
            <ArrowLeft className="w-5 h-5" />
            返回
          </Link>
          <h1 className="text-lg font-medium text-slate-50">編輯資料</h1>
          <div className="w-16"></div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* 成功提示 */}
        {saveSuccess && (
          <div className="mb-6 p-4 bg-green-500/20 border border-green-500/30 rounded-xl flex items-center gap-3">
            <Check className="w-5 h-5 text-green-400" />
            <span className="text-green-400">保存成功！即將跳轉...</span>
          </div>
        )}

        {/* 頭像 */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6 mb-6">
          <div className="flex flex-col items-center">
            <div 
              className="relative cursor-pointer group"
              onClick={handleAvatarClick}
            >
              <div className="w-28 h-28 rounded-full overflow-hidden bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center ring-4 ring-slate-700">
                {avatarPreview ? (
                  <img 
                    src={avatarPreview} 
                    alt="頭像" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 text-slate-900" />
                )}
              </div>
              
              {/* 懸停遮罩 */}
              <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                {uploadingAvatar ? (
                  <div className="text-white text-xs">上傳中...</div>
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </div>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
            
            <p className="mt-3 text-sm text-slate-400">點擊更換頭像</p>
          </div>
        </div>

        {/* 基本資料 */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-lg font-medium text-slate-50 mb-6">基本資料</h2>
          
          <div className="space-y-5">
            {/* 姓名 */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <span className="flex items-center gap-2">
                  <User className="w-4 h-4 text-cyan-400" />
                  乘客姓名
                </span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setNameError('')
                }}
                placeholder="請輸入您的姓名"
                className={`w-full px-4 py-3 bg-slate-900/50 border rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${
                  nameError ? 'border-red-500' : 'border-slate-600'
                }`}
              />
              {nameError && (
                <p className="mt-1 text-sm text-red-400">{nameError}</p>
              )}
            </div>
            
            {/* 電話 */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <span className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-cyan-400" />
                  聯絡電話
                </span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value)
                  setPhoneError('')
                }}
                placeholder="請輸入聯絡電話"
                className={`w-full px-4 py-3 bg-slate-900/50 border rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${
                  phoneError ? 'border-red-500' : 'border-slate-600'
                }`}
              />
              {phoneError && (
                <p className="mt-1 text-sm text-red-400">{phoneError}</p>
              )}
              <p className="mt-1 text-xs text-slate-500">電話號碼將用於司機聯絡您</p>
            </div>
            
            {/* 電郵（只讀） */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <span className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-cyan-400" />
                  電郵地址
                </span>
              </label>
              <input
                type="email"
                value={profile?.email || ''}
                readOnly
                disabled
                className="w-full px-4 py-3 bg-slate-900/30 border border-slate-700 rounded-lg text-slate-500 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-slate-500">電郵地址無法修改</p>
            </div>
          </div>
        </div>

        {/* 保存按鈕 */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full mt-6 py-4 bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-900 font-medium rounded-xl hover:from-cyan-400 hover:to-teal-400 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              保存更改
            </>
          )}
        </button>

        {/* 提示 */}
        <p className="mt-4 text-center text-sm text-slate-500">
          保存後，預約訂單時將自動填入您的姓名和電話
        </p>
      </main>
    </div>
  )
}
