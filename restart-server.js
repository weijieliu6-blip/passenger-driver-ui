// 强制重启开发服务器
const { execSync } = require('child_process')

console.log('🛑 正在停止旧服务器...')

try {
  // Windows: 查找并杀死占用 3000 端口的进程
  const findCmd = 'netstat -ano | findstr :3000'
  const result = execSync(findCmd, { encoding: 'utf8' })
  
  // 提取 PID
  const lines = result.split('\n').filter(line => line.includes('LISTENING'))
  if (lines.length > 0) {
    const pid = lines[0].trim().split(/\s+/).pop()
    console.log(`找到进程 PID: ${pid}`)
    execSync(`taskkill /F /PID ${pid}`)
    console.log('✅ 旧服务器已停止')
  }
} catch (err) {
  console.log('⚠️  未找到运行中的服务器或已停止')
}

console.log('\n🚀 启动新服务器...')
console.log('请在终端运行: npm run dev')
