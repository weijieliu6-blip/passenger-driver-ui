import { supabaseAdmin } from '../lib/supabase'

async function testDatabase() {
  try {
    console.log('🔍 測試數據庫連接...')
    
    // 查詢訂單表
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, status, created_at')
      .limit(5)
    
    if (error) {
      console.error('❌ 數據庫錯誤:', error)
      return
    }
    
    console.log('✅ 數據庫連接成功！')
    console.log('📊 訂單數量:', data?.length || 0)
    
    if (data && data.length > 0) {
      console.log('📋 最近的訂單:')
      console.table(data)
    } else {
      console.log('📋 目前沒有訂單數據')
    }
    
  } catch (err) {
    console.error('❌ 測試失敗:', err)
  }
}

testDatabase()
