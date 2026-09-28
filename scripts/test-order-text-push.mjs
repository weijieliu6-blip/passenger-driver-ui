// Test order creation via /api/orders/create to verify DingTalk text-mode push
const body = {
  direction:      'hk_to_mainland',
  pickupLocation: '香港中環IFC',
  pickupArea:     '中環',
  dropoffLocation:'深圳福田口岸',
  dropoffArea:    '福田',
  departureTime:  '2026-09-28 16:00',
  passengers:     4,
  vehicleType:    '7_seat',
  passengerName:  '測試乘客',
  passengerPhone: '13800138000',
  luggage:        2,
  estimatedFare:  1200,
  passengerNotes: '【測試訂單】會員分級推送',
};

(async () => {
  try {
    const res = await fetch('http://localhost:3000/api/orders/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    console.log('HTTP', res.status);
    console.log(text);
  } catch (e) {
    console.error('FETCH ERR', e.message);
    process.exit(1);
  }
})();
