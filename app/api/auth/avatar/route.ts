import { NextRequest, NextResponse } from 'next/server'
import { getCurrentPassenger } from '@/lib/auth-server'
import { createServerClient } from '@/lib/auth-server'

/**
 * 上傳頭像
 * POST /api/auth/avatar
 */
export async function POST(request: NextRequest) {
  try {
    const passenger = await getCurrentPassenger(request)
    
    if (!passenger) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('avatar') as File

    if (!file) {
      return NextResponse.json(
        { success: false, error: '請選擇圖片' },
        { status: 400 }
      )
    }

    // 驗證文件類型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: '只支援 JPG、PNG、GIF、WebP 格式' },
        { status: 400 }
      )
    }

    // 驗證文件大小 (最大 2MB)
    const maxSize = 2 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: '圖片大小不能超過 2MB' },
        { status: 400 }
      )
    }

    // 讀取文件內容
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // 生成唯一文件名
    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `avatars/${passenger.id}-${Date.now()}.${ext}`

    // 上傳到 Supabase Storage
    const supabase = createServerClient()
    const { data, error } = await supabase.storage
      .from('avatars')  // 需要在 Supabase 創建名為 'avatars' 的 bucket
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true  // 覆蓋同名文件
      })

    if (error) {
      console.error('Upload to storage error:', error)
      // 如果存儲桶不存在，返回錯誤提示
      if (error.message?.includes('not found') || error.message?.includes('bucket')) {
        return NextResponse.json(
          { success: false, error: '頭像存儲服務未配置，請聯繫管理員' },
          { status: 500 }
        )
      }
      return NextResponse.json(
        { success: false, error: '上傳失敗，請稍後重試' },
        { status: 500 }
      )
    }

    // 獲取公開 URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName)

    // 更新用戶頭像 URL
    await supabase
      .from('users')
      .update({ avatar_url: urlData.publicUrl })
      .eq('id', passenger.id)

    return NextResponse.json({
      success: true,
      avatar_url: urlData.publicUrl
    })
  } catch (error: any) {
    console.error('Upload avatar failed:', error)
    return NextResponse.json(
      { success: false, error: error.message || '上傳失敗' },
      { status: 500 }
    )
  }
}
