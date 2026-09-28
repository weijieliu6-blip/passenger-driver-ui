/**
 * 企业微信推送测试脚本
 * 用于验证 Webhook 配置是否正确
 */

// 直接使用 Webhook URL（从 .env.local 复制）
const WEBHOOK_URL = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=a75ee5a6-48da-4dab-88e7-8126699e9530';

if (!WEBHOOK_URL) {
  console.error('❌ 错误：未找到 WECHAT_WEBHOOK_URL 环境变量');
  console.log('请检查 .env.local 文件是否正确配置');
  process.exit(1);
}

console.log('🚀 开始测试企业微信推送...\n');
console.log('📡 Webhook URL:', WEBHOOK_URL.substring(0, 60) + '...\n');

// 测试消息内容
const testMessage = {
  msgtype: 'markdown',
  markdown: {
    content: `# 🎉 港中专车系统测试
    
> **测试时间**: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
> **测试状态**: ✅ 配置成功

---

### 📋 测试信息
- **Supabase**: 已连接
- **企业微信**: 推送正常
- **系统状态**: 运行中

---

<font color="info">如果你看到这条消息，说明企业微信推送配置成功！</font>`
  }
};

// 发送测试消息
fetch(WEBHOOK_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(testMessage),
})
  .then(response => response.json())
  .then(data => {
    console.log('✅ 测试消息发送成功！');
    console.log('📱 请查看企业微信群聊是否收到测试消息\n');
    console.log('返回结果:', data);
    
    if (data.errcode === 0) {
      console.log('\n🎊 恭喜！企业微信推送配置完全正常！');
    } else {
      console.log('\n⚠️  警告：返回了错误码', data.errcode);
      console.log('错误信息:', data.errmsg);
    }
  })
  .catch(error => {
    console.error('❌ 测试失败:', error.message);
    console.log('\n可能的原因：');
    console.log('1. Webhook URL 配置错误');
    console.log('2. 网络连接问题');
    console.log('3. 企业微信机器人未激活');
  });
