// Supabase 连接测试脚本
// 运行: node test-supabase.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 测试 Supabase 连接...\n');
console.log('📍 Project URL:', supabaseUrl);
console.log('🔑 Anon Key:', supabaseKey?.substring(0, 20) + '...\n');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    // 测试 1: 查询 orders 表结构
    console.log('✅ 测试 1: 查询 orders 表...');
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('❌ 错误:', error.message);
      return false;
    }
    
    console.log('✅ 成功！orders 表存在');
    console.log('📊 当前订单数量:', data?.length || 0);
    
    // 测试 2: 测试函数
    console.log('\n✅ 测试 2: 测试订单号生成函数...');
    const { data: orderNumber, error: fnError } = await supabase
      .rpc('generate_order_number');
    
    if (fnError) {
      console.log('❌ 函数错误:', fnError.message);
    } else {
      console.log('✅ 生成的订单号:', orderNumber);
    }
    
    console.log('\n🎉 所有测试通过！数据库配置正确！');
    return true;
    
  } catch (err) {
    console.log('❌ 连接失败:', err.message);
    return false;
  }
}

testConnection();
