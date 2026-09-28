import { NextRequest, NextResponse } from 'next/server'
import { pushOrderActionCard } from '@/lib/dingtalk'

/**
 * 內部呼叫：手動觸發某筆訂單的 ActionCard 推播
 * POST /api/dingtalk/push
 *
 * 用於：
 *   1) 補推（push 失敗後重試）
 *   2) 測試 webhook（用真實訂單號）
 *
 * 安全：需要內部 secret header（避免外部亂打）
 */

export async function POST(request: NextRequest) {
  try {
    const internalSecret = process.env.INTERNAL_API_SECRET
    const provided = request.headers.get('x-internal-secret')

    // 沒設 secret 就拒絕；防止意外對外開放
    if (!internalSecret || provided !== internalSecret) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body || !body.orderNumber || !body.grabToken) {
      return NextResponse.json(
        { error: '缺少 orderNumber / grabToken' },
        { status: 400 }
      )
    }

    const result = await pushOrderActionCard({
      orderNumber: body.orderNumber,
      grabToken: body.grabToken,
      direction: body.direction ?? '',
      pickupLocation: body.pickupLocation ?? '',
      pickupArea: body.pickupArea ?? null,
      dropoffLocation: body.dropoffLocation ?? '',
      dropoffArea: body.dropoffArea ?? null,
      departureTime: body.departureTime ?? '',
      vehicleType: body.vehicleType ?? '',
      passengers: body.passengers ?? 1,
      luggage: body.luggage ?? 0,
      passengerName: body.passengerName ?? null,
      passengerPhone: body.passengerPhone ?? '',
      estimatedFare: body.estimatedFare ?? null,
    })

    if (result.success) {
      return NextResponse.json({ success: true })
    }
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 502 }
    )
  } catch (error) {
    console.error('[POST /api/dingtalk/push] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '推送失敗' },
      { status: 500 }
    )
  }
}