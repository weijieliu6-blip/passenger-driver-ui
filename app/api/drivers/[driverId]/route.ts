import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * 獲取司機公開詳情 API
 * GET /api/drivers/[driverId]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ driverId: string }> }
) {
  try {
    const { driverId } = await params

    if (!driverId) {
      return NextResponse.json(
        { success: false, error: '缺少司機 ID' },
        { status: 400 }
      )
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, name, phone, avatar_url, role, created_at')
      .eq('id', driverId)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: '司機不存在' },
        { status: 404 }
      )
    }

    if (user.role !== 'driver') {
      return NextResponse.json(
        { success: false, error: '該用戶不是司機' },
        { status: 400 }
      )
    }

    const [
      { data: driverInfo },
      { data: reviews },
    ] = await Promise.all([
      supabaseAdmin
        .from('driver_info')
        .select('id, vehicle_plate, vehicle_model, driving_years, rating, total_orders, total_rating_count, membership_tier')
        .eq('id', driverId)
        .maybeSingle(),
      supabaseAdmin
        .from('orders')
        .select(
          'id, order_number, rating, rated_at, passenger_name, pickup_location, dropoff_location'
        )
        .eq('driver_id', driverId)
        .not('rating', 'is', null)
        .order('rated_at', { ascending: false })
        .limit(5),
    ])

    const { count: totalOrdersCount } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('driver_id', driverId)
      .in('status', ['grabbed', 'price_confirmed', 'completed'])

    const maskPhone = (phone: string) => {
      if (!phone || phone.length < 8) return phone
      const cleaned = phone.replace(/[\s\-+]/g, '')
      if (cleaned.length === 8) {
        return `${cleaned.slice(0, 2)} **** ${cleaned.slice(6)}`
      }
      if (cleaned.length === 11) {
        return `${cleaned.slice(0, 3)} **** ${cleaned.slice(7)}`
      }
      return phone
    }

    const maskPlate = (plate?: string | null) => {
      if (!plate) return ''
      if (plate.length <= 4) return plate
      return `${plate.slice(0, 1)}•${plate.slice(2, plate.length - 3)} ${plate.slice(-3)}`
    }

    return NextResponse.json({
      success: true,
      driver: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        maskedPhone: maskPhone(user.phone),
        avatarUrl: user.avatar_url,
        joinedAt: user.created_at,

        vehiclePlate: maskPlate(driverInfo?.vehicle_plate),
        vehiclePlateFull: driverInfo?.vehicle_plate,
        vehicleModel: driverInfo?.vehicle_model || '未填寫',
        drivingYears: driverInfo?.driving_years ?? 0,

        rating: driverInfo?.rating ?? 5.0,
        totalOrders: totalOrdersCount ?? driverInfo?.total_orders ?? 0,
        totalRatingCount: driverInfo?.total_rating_count ?? 0,

        membershipTier: driverInfo?.membership_tier || 'gold',
        maxPassengers: 7,
        maxLuggage: 4,
      },
      reviews:
        reviews?.map((r: any) => ({
          orderNumber: r.order_number,
          rating: r.rating,
          ratedAt: r.rated_at,
          passengerName: r.passenger_name
            ? `${r.passenger_name.charAt(0)}先生/女士`
            : '匿名乘客',
          route: `${r.pickup_location} → ${r.dropoff_location}`,
        })) || [],
    })
  } catch (error: any) {
    console.error('Get driver detail error:', error)
    return NextResponse.json(
      {
        success: false,
        error: '獲取司機資料失敗',
        message: error.message || '未知錯誤',
      },
      { status: 500 }
    )
  }
}