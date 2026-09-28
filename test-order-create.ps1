$jsonBody = @'
{
    "serviceType": "cross_border",
    "direction": "hk_to_mainland",
    "pickupLocation": "九龍",
    "pickupArea": "油尖旺區",
    "dropoffLocation": "深圳",
    "dropoffArea": "深圳灣口岸",
    "departureDate": "2026-09-20",
    "departureTime": "10:30",
    "passengers": 2,
    "luggage": 1,
    "vehicleType": "7_seat",
    "isCharter": false,
    "hasChild": false,
    "childType": "",
    "passengerName": "測試乘客",
    "passengerPhone": "13800138000",
    "passengerNotes": "請準時到達",
    "estimatedFare": {
        "minFare": 324,
        "maxFare": 396
    }
}
'@

$response = Invoke-RestMethod -Uri 'http://localhost:3000/api/orders/create' -Method Post -ContentType 'application/json' -Body $jsonBody

Write-Host "Order created successfully!"
Write-Host "Order Number: $($response.order.orderNumber)"
Write-Host "Status: $($response.order.status)"
