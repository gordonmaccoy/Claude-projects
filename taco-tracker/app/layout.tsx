import type { Metadata } from 'next'
import { Fraunces } from 'next/font/google'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Taco Tracker Korea',
  description: '서울 최고의 멕시코 음식을 찾아보세요 — Find the best Mexican food in Seoul',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={fraunces.variable}>
      <body>{children}</body>
    </html>
  )
}
