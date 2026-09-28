'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, Car, Star, Award, ArrowLeft, Save } from 'lucide-react'
import { supabase, User as UserType } from '@/lib/supabase'
import { getMembershipTierLabel, getMembershipBenefits, getMembershipPrice } from '@/lib/membership'

interface DriverInfoRow {
  id: string
  vehicle_plate: string
  vehicle_model?: string | null
  rating: number
  membership_tier: 'gold' | 'platinum' | 'normal' | 'none'
}

export default function DriverProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<UserType | null>(null)
  const [profile, setProfile] = useState<DriverInfoRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)

  const [formData, setFormData] = useState({
    vehicle_plate: '',
    vehicle_model: '',
  })

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (!authUser) {
        router.push('/')
        return
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (userError) throw userError
      setUser(userData)

      const { data: profileData, error: profileError } = await supabase
        .from('driver_info')
        .select('id, vehicle_plate, vehicle_model, rating, membership_tier')
        .eq('id', authUser.id)
        .single()

      if (profileError) throw profileError
      setProfile(profileData)

      setFormData({
        vehicle_plate: profileData.vehicle_plate,
        vehicle_model: profileData.vehicle_model || '',
      })
    } catch (error) {
      console.error('載入資料失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (!authUser) {
        alert('請先登入')
        return
      }

      const { error } = await supabase
        .from('driver_info')
        .update({
          vehicle_plate: formData.vehicle_plate,
          vehicle_model: formData.vehicle_model || null,
        })
        .eq('id', authUser.id)

      if (error) throw error

      alert('保存成功！')
      setEditMode(false)
      loadProfile()
    } catch (error: any) {
      console.error('保存失敗:', error)
      alert(error.message || '保存失敗，請稍後重試')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-slate-400">載入中...</div>
      </div>
    )
  }

  if (!profile || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-slate-400">無法載入資料</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => router.push('/driver/dashboard')}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            返回接單大廳
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 shadow-xl mb-6">
          <div className="flex items-center gap-6 mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-full flex items-center justify-center">
              <User className="w-10 h-10 text-slate-900" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-50 mb-1">{user.name}</h2>
              <div className="text-slate-400">{user.phone}</div>
              <div className="flex items-center gap-2 mt-2">
                <Star className="w-5 h-5 text-yellow-400 fill-current" />
                <span className="text-lg font-semibold text-yellow-400">{profile.rating.toFixed(1)}</span>
                <span className="text-sm text-slate-400">司機評分</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-cyan-500/10 to-teal-500/10 border border-cyan-500/30 rounded-2xl p-8 shadow-xl mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Award className="w-8 h-8 text-cyan-400" />
                <h3 className="text-2xl font-bold text-slate-50">
                  {getMembershipTierLabel(profile.membership_tier)}
                </h3>
              </div>
              <div className="text-sm text-slate-400">
                月費：
                <span className="text-lg font-semibold text-cyan-400 ml-2">
                  HKD ${getMembershipPrice(profile.membership_tier)}
                </span>
              </div>
            </div>
            {profile.membership_tier !== 'platinum' && (
              <button className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-900 font-medium rounded-lg hover:from-orange-400 hover:to-amber-400 transition">
                升級會員
              </button>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-300 mb-3">會員特權：</div>
            {getMembershipBenefits(profile.membership_tier).map((benefit, index) => (
              <div key={index} className="flex items-center gap-2 text-sm text-slate-300">
                <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></div>
                {benefit}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Car className="w-6 h-6 text-cyan-400" />
              <h3 className="text-xl font-bold text-slate-50">車輛信息</h3>
            </div>
            {!editMode && (
              <button
                onClick={() => setEditMode(true)}
                className="px-4 py-2 bg-slate-700 text-slate-300 font-medium rounded-lg hover:bg-slate-600 transition"
              >
                編輯
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">車牌號碼</label>
              {editMode ? (
                <input
                  type="text"
                  value={formData.vehicle_plate}
                  onChange={(e) => setFormData({ ...formData, vehicle_plate: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
                />
              ) : (
                <div className="px-4 py-3 bg-slate-900/30 border border-slate-700/50 rounded-lg text-slate-50">
                  {profile.vehicle_plate}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">車輛型號</label>
              {editMode ? (
                <input
                  type="text"
                  value={formData.vehicle_model}
                  onChange={(e) => setFormData({ ...formData, vehicle_model: e.target.value })}
                  placeholder="例如: Toyota Alphard"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
                />
              ) : (
                <div className="px-4 py-3 bg-slate-900/30 border border-slate-700/50 rounded-lg text-slate-50">
                  {profile.vehicle_model || '待補充'}
                </div>
              )}
            </div>

            {editMode && (
              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => {
                    setEditMode(false)
                    setFormData({
                      vehicle_plate: profile.vehicle_plate,
                      vehicle_model: profile.vehicle_model || '',
                    })
                  }}
                  className="flex-1 px-6 py-3 bg-slate-700 text-slate-300 font-medium rounded-lg hover:bg-slate-600 transition"
                  disabled={saving}
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-900 font-semibold rounded-lg hover:from-cyan-400 hover:to-teal-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  {saving ? '保存中...' : '保存修改'}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}