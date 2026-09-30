import type { NextConfig } from "next";

/**
 * 全域 security headers（M7）
 * - CSP: 限制外部資源載入（Supabase + 自家網域）
 * - X-Content-Type-Options: 禁止 MIME sniffing
 * - X-Frame-Options: 禁止被嵌入 iframe（防 clickjacking）
 * - Referrer-Policy: 限制 referrer 資訊
 * - Permissions-Policy: 禁用未使用的瀏覽器 API
 */
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in",
      "media-src 'self' blob: https://*.supabase.co",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js 需要 unsafe-inline/eval
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data: https://*.supabase.co",
      "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co wss://*.supabase.in https://oapi.dingtalk.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self), payment=()',
  },
  // HSTS：HTTPS 生產環境才送
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
    : []),
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
