'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  User, Star, Car, Clock, Award, Phone, Shield, ArrowLeft,
  MapPin, Calendar, ChevronRight, Sparkles
} from 'lucide-react'

interface DriverData {
  id: string
  name: string
  phone: string
  maskedPhone: string
  avatarUrl?: string | null
  joinedAt: string
  vehiclePlate: string
  vehiclePlateFull?: string
  vehicleModel: string
  drivingYears: number
  rating: number
  totalOrders: number
  totalRatingCount: number
  membershipTier: 'free' | 'gold' | 'diamond'
  maxPassengers: number
  maxLuggage: number
}

interface Review {
  orderNumber: string
  rating: number
  ratedAt: string
  passengerName: string
  route: string
}

export default function DriverPublicProfilePage() {
  const params = useParams()
  const router = useRouter()
  const driverId = params.driverId as string

  const [driver, setDriver] = useState<DriverData | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (driverId) fetchDriver()
  }, [driverId])

  const fetchDriver = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/drivers/${driverId}`)
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || '司機資料不存在')
      }

      setDriver(data.driver)
      setReviews(data.reviews || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getMembershipBadge = (tier: string) => {
    switch (tier) {
      case 'diamond':
        return { label: '鑽石會員', className: 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white' }
      case 'gold':
        return { label: '黃金會員', className: 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white' }
      default:
        return { label: '普通司機', className: 'bg-slate-700 text-slate-300' }
    }
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-slate-600'
            }`}
          />
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-slate-400">載入司機資料...</div>
      </div>
    )
  }

  if (error || !driver) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800/50 border border-slate-700 rounded-2xl p-8 text-center">
          <User className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-slate-200 mb-2">{error || '司機資料不存在'}</h1>
          <button
            onClick={() => router.back()}
            className="mt-4 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl"
          >
            返回
          </button>
        </div>
      </div>
    )
  }

  const membershipBadge = getMembershipBadge(driver.membershipTier)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-slate-400 hover:text-cyan-400 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            返回
          </button>
          <h1 className="text-base font-semibold text-slate-100">司機詳情</h1>
          <div className="w-12"></div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* 司機頭像和基本資料 */}
        <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-amber-500/5 border border-amber-500/30 rounded-2xl p-6 mb-4">
          <div className="flex items-start gap-4">
            {/* 頭像 */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center ring-4 ring-amber-500/20">
                {driver.avatarUrl ? (
                  <img src={driver.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <User className="w-12 h-12 text-slate-900" />
                )}
              </div>
              {driver.membershipTier === 'diamond' && (
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center ring-2 ring-slate-900">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-100">{driver.name}</h1>
                <span className={`px-2 py-0.5 text-xs font-bold rounded ${membershipBadge.className}`}>
                  {membershipBadge.label}
                </span>
              </div>

              {/* 評分 */}
              <div className="flex items-center gap-2 mb-3">
                {renderStars(driver.rating)}
                <span className="text-lg font-semibold text-yellow-400">{driver.rating.toFixed(1)}</span>
                <span className="text-sm text-slate-400">({driver.totalRatingCount} 評價)</span>
              </div>

              {/* 統計 */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-cyan-400">
                  <Award className="w-4 h-4" />
                  <span>已接 {driver.totalOrders} 單</span>
                </div>
                <div className="flex items-center gap-1 text-slate-400">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(driver.joinedAt).getFullYear()} 年加入</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 車輛信息 */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6 mb-4">
          <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <Car className="w-5 h-5 text-amber-400" />
            車輛信息
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-900/50 rounded-lg">
              <p className="text-xs text-slate-400 mb-1">車輛型號</p>
              <p className="text-slate-100 font-medium">{driver.vehicleModel}</p>
            </div>
            <div className="p-3 bg-slate-900/50 rounded-lg">
              <p className="text-xs text-slate-400 mb-1">車牌號碼</p>
              <p className="text-slate-100 font-mono">{driver.vehiclePlate}</p>
            </div>
            <div className="p-3 bg-slate-900/50 rounded-lg">
              <p className="text-xs text-slate-400 mb-1">駕齡</p>
              <p className="text-slate-100 font-medium">{driver.drivingYears} 年</p>
            </div>
            <div className="p-3 bg-slate-900/50 rounded-lg">
              <p className="text-xs text-slate-400 mb-1">載客容量</p>
              <p className="text-slate-100 font-medium">
                {driver.maxPassengers} 人 · {driver.maxLuggage} 件行李
              </p>
            </div>
          </div>
        </div>

        {/* 聯繫司機 */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6 mb-4">
          <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <Phone className="w-5 h-5 text-amber-400" />
            聯繫司機
          </h2>

          <div className="space-y-3">
            <a
              href={`tel:${driver.phone}`}
              className="flex items-center justify-between p-4 bg-gradient-to-r from-sky-500/10 to-cyan-500/10 hover:from-sky-500/20 hover:to-cyan-500/20 border border-sky-500/30 rounded-xl transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-sky-500/20 rounded-lg flex items-center justify-center">
                  <Phone className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">司機電話</p>
                  <p className="text-slate-100 font-mono">{driver.maskedPhone}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-sky-400 group-hover:translate-x-1 transition-transform" />
            </a>

            <a
              href="tel:4001234567"
              className="flex items-center justify-between p-4 bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600 rounded-xl transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-600/50 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-slate-300" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">聯繫平台</p>
                  <p className="text-slate-100 font-mono">400-123-4567</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
        </div>

        {/* 乘客評價 */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400" />
              乘客評價 ({driver.totalRatingCount})
            </h2>
          </div>

          {reviews.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Star className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p>暫無評價</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((review, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-slate-900/50 border border-slate-700/30 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {renderStars(review.rating)}
                      <span className="text-sm font-medium text-slate-200">
                        {review.passengerName}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {new Date(review.ratedAt).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <MapPin className="w-3 h-3" />
                    <span>{review.route}</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">訂單 #{review.orderNumber}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部提示 */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            為保障雙方權益，請通過平台內溝通
          </p>
        </div>
      </main>
    </div>
  )
}
