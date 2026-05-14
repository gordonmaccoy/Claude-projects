import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Taco Map',
  description: '서울 최고의 멕시코 음식을 찾아보세요 — Find the best Mexican food in Seoul',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children
}
