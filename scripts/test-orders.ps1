$ErrorActionPreference = 'Stop'

$apiBase = 'https://hk-mainland-taxi.com/api/orders/create'

$orders = @(
  @{
    direction       = 'hk_to_mainland'
    pickupLocation  = '中環 IFC 香港站'
    pickupArea      = '中環'
    dropoffLocation = '深圳灣口岸'
    dropoffArea     = '南山'
    departureTime   = '2026-09-29 09:00'
    passengers      = 2
    luggage         = 2
    vehicleType     = '5_seat'
    passengerName   = '陳先生'
    passengerPhone  = '91234567'
    estimatedFare   = 800
    testMode        = $true
  },
  @{
    direction       = 'mainland_to_hk'
    pickupLocation  = '深圳福田口岸'
    pickupArea      = '福田'
    dropoffLocation = '尖沙咀重慶站'
    dropoffArea     = '尖沙咀'
    departureTime   = '2026-09-30 14:00'
    passengers      = 4
    luggage         = 3
    vehicleType     = '7_seat'
    passengerName   = '李小姐'
    passengerPhone  = '92345678'
    estimatedFare   = 1200
    testMode        = $true
  },
  @{
    direction       = 'sz_to_sw'
    pickupLocation  = '深圳南山科技園'
    pickupArea      = '南山'
    dropoffLocation = '珠海拱北口岸'
    dropoffArea     = '拱北'
    departureTime   = '2026-09-29 16:30'
    passengers      = 2
    luggage         = 1
    vehicleType     = '5_seat'
    passengerName   = '王先生'
    passengerPhone  = '93456789'
    estimatedFare   = 1500
    testMode        = $true
  },
  @{
    direction       = 'mainland_to_hk'
    pickupLocation  = '廣州天河城'
    pickupArea      = '天河'
    dropoffLocation = '港島東太古城'
    dropoffArea     = '太古城'
    departureTime   = '2026-09-30 08:00'
    passengers      = 7
    luggage         = 6
    vehicleType     = '9_seat'
    passengerName   = '張總'
    passengerPhone  = '94567890'
    estimatedFare   = 2500
    testMode        = $true
  },
  @{
    direction       = 'hk_to_mainland'
    pickupLocation  = '銅鑼灣時代廣場'
    pickupArea      = '銅鑼灣'
    dropoffLocation = '福田口岸'
    dropoffArea     = '福田'
    departureTime   = '2026-10-01 11:00'
    passengers      = 3
    luggage         = 3
    vehicleType     = '7_seat'
    passengerName   = '林太'
    passengerPhone  = '95678901'
    estimatedFare   = 900
    testMode        = $true
  }
)

$results = @()

for ($i = 0; $i -lt $orders.Count; $i++) {
  $order = $orders[$i]
  Write-Host ""
  Write-Host "========================================" -ForegroundColor Cyan
  Write-Host "測試訂單 #$($i+1): $($order.passengerName) - $($order.direction)" -ForegroundColor Cyan
  Write-Host "========================================" -ForegroundColor Cyan

  $json = $order | ConvertTo-Json -Depth 10 -Compress

  try {
    $response = Invoke-WebRequest -Uri $apiBase `
      -Method POST `
      -Headers @{ 'Content-Type' = 'application/json' } `
      -Body $json `
      -UseBasicParsing `
      -TimeoutSec 30

    $body = $response.Content | ConvertFrom-Json
    Write-Host "HTTP $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Order: $($body.order.orderNumber)"
    Write-Host "GrabToken: $($body.order.grabToken)"

    $results += @{
      index    = $i + 1
      name     = $order.passengerName
      status   = 'OK'
      orderNo  = $body.order.orderNumber
      token    = $body.order.grabToken
    }
  } catch {
    $statusCode = 'N/A'
    $errBody = ''
    if ($_.Exception.Response) {
      $statusCode = [int]$_.Exception.Response.StatusCode
      try { $errBody = (New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd() } catch {}
    }
    Write-Host "HTTP $statusCode - ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Body: $errBody" -ForegroundColor Yellow

    $results += @{
      index   = $i + 1
      name    = $order.passengerName
      status  = 'FAIL'
      error   = $_.Exception.Message
      body    = $errBody
    }
  }

  Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "全部測試結果摘要" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
$results | Format-Table -AutoSize
