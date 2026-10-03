import { RestaurantList } from '@/components/restaurant-list'
import { getTranslations } from 'next-intl/server'

interface Props {
  params: Promise<{ locale: 'ko' | 'en' }>
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'home' })
  return (
    <main className="mx-auto w-full px-4 pb-8 pt-6 sm:px-6 sm:pt-8 2xl:max-w-[1600px]">
      <div className="mb-5 max-w-3xl sm:mb-7">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand">{t('eyebrow')}</p>
        <h1 className="font-display text-[2.25rem] leading-[1.08] tracking-[-0.04em] text-ink sm:text-5xl">{t('heading')}</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">{t('description')}</p>
      </div>
      <RestaurantList status="live" locale={locale} />
    </main>
  )
}
