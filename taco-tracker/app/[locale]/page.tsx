import { getTranslations } from 'next-intl/server'
import { RestaurantList } from '@/components/restaurant-list'

interface Props {
  params: Promise<{ locale: 'ko' | 'en' }>
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations('listing')

  return (
    <main className="mx-auto w-full px-4 py-4 sm:px-6 sm:py-6 2xl:max-w-[1600px]">
      <h1 className="mb-3 font-display text-2xl text-ink sm:text-3xl">{t('title')}</h1>
      <RestaurantList status="live" locale={locale} />
    </main>
  )
}
