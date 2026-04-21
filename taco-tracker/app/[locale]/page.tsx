import { useTranslations } from 'next-intl'

export default function HomePage() {
  const t = useTranslations('home')
  return (
    <main style={{ minHeight: '100vh', padding: 32, background: 'var(--color-bg)' }}>
      <h1 style={{ color: 'var(--color-brand)', fontFamily: 'var(--font-display)', fontSize: 32 }}>
        {t('heading')}
      </h1>
    </main>
  )
}
