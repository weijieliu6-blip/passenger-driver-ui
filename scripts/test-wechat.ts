/**
 * 企业微信推送测试脚本
 * 用途：测试企业微信机器人是否配置成功
 * 
 * 使用方法：
 * 1. 在 .env.local 中配置 WECHAT_WEBHOOK_URL
 * 2. 运行: npx tsx scripts/test-wechat.ts
 */

async function testWechatPush() {
  const webhookUrl = process.env.WECHAT_WEBHOOK_URL
  
  if (!webhookUrl) {
    console.error('❌ 错误：未配置 WECHAT_WEBHOOK_URL')
    console.log('\n请在 .env.local 中添加：')
    console.log('WECHAT_WEBHOOK_URL=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=你的key')
    return
  }
  
  console.log('🚀 开始测试企业微信推送...')
  console.log('📡 Webhook URL:', webhookUrl.substring(0, 60) + '...')
  
  // 测试消息 1: 纯文本
  console.log('\n📤 发送测试消息 1: 纯文本...')
  const textMessage = {
    msgtype: 'text',
    text: {
      content: '✅ 测试成功！企业微信机器人已正常工作。\n\n这是来自港中专车平台的测试消息。'
    }
  }
  
  try {
    const response1 = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(textMessage)
    })
    
    const result1 = await response1.json()
    
    if (result1.errcode === 0) {
      console.log('✅ 纯文本消息发送成功！')
    } else {
      console.error('❌ 发送失败:', result1.errmsg)
      return
    }
  } catch (error) {
    console.error('❌ 网络错误:', error)
    return
  }
  
  // 等待 2 秒
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  // 测试消息 2: Markdown 格式（模拟订单通知）
  console.log('\n📤 发送测试消息 2: Markdown 格式订单通知...')
  const markdownMessage = {
    msgtype: 'markdown',
    markdown: {
      content: `## 🚗 新订单通知 #TEST001

**📍 路线**
深圳湾口岸 → 香港九龙尖沙咀

**⏰ 出发时间**
2026-09-20 10:30

**👥 乘车信息**
人数：3人 | 行李：2件 | 车型：7座车

**📝 备注**
需要婴儿座椅

---
[👉 点击抢单](http://localhost:3000/grab/test-token-123)

<@all>`
    }
  }
  
  try {
    const response2 = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(markdownMessage)
    })
    
    const result2 = await response2.json()
    
    if (result2.errcode === 0) {
      console.log('✅ Markdown 订单消息发送成功！')
    } else {
      console.error('❌ 发送失败:', result2.errmsg)
      return
    }
  } catch (error) {
    console.error('❌ 网络错误:', error)
    return
  }
  
  console.log('\n🎉 测试完成！请检查企业微信群是否收到两条消息：')
  console.log('   1. 纯文本测试消息')
  console.log('   2. 模拟的订单通知（Markdown格式）')
  console.log('\n✅ 如果都收到了，说明企业微信配置成功！')
}

testWechatPush()
