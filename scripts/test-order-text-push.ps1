$body = @{
  pickup        = '香港中環IFC'
  dropoff       = '深圳福田口岸'
  pickupTime    = '2026-09-28 16:00'
  passengers    = 4
  carType       = 'alphard_7'
  passengerName = '測試乘客'
  passengerPhone= '13800138000'
  luggage       = 2
  remark        = '【測試訂單】會員分級推送'
} | ConvertTo-Json -Depth 5

try {
  $r = Invoke-RestMethod -Method POST -Uri 'http://localhost:3000/api/orders/create' -ContentType 'application/json' -Body $body -TimeoutSec 20
  Write-Host '=== RESPONSE ==='
  $r | ConvertTo-Json -Depth 6
} catch {
  Write-Host ('HTTP ERR ' + $_.Exception.Response.StatusCode.value__)
  $stream = $_.Exception.Response.GetResponseStream()
  $reader = New-Object System.IO.StreamReader($stream)
  Write-Host '=== BODY ==='
  Write-Host $reader.ReadToEnd()
}
