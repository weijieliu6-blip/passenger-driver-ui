Write-Host "正在停止所有 Node.js 进程..."
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

Write-Host "正在删除 Next.js 缓存..."
$cachePath = "C:\Users\weiji\.cursor\project_prd.md\.next"
if (Test-Path $cachePath) {
    Remove-Item $cachePath -Recurse -Force
    Write-Host "缓存已删除"
} else {
    Write-Host "没有找到缓存文件夹"
}

Write-Host "`n✅ 完成！请手动运行 'npm run dev' 重启服务器"
