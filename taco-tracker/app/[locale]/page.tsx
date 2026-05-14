import { getTranslations } from 'next-intl/server'
import { RestaurantList } from '@/components/restaurant-list'

interface Props {
  params: Promise<{ locale: 'ko' | 'en' }>
  searchParams: Promise<{ neighborhood?: string }>
}

export default async function HomePage({ params, searchParams }: Props) {
  const { locale } = await params
  const { neighborhood } = await searchParams
  const t = await getTranslations('listing')

  return (
    <main className="mx-auto w-full px-4 py-8 sm:px-6 sm:py-12 2xl:max-w-[1600px]">
      <h1 className="mb-6 font-display text-3xl text-ink sm:text-4xl">
        {t('title')}
      </h1>
      <RestaurantList
        status="live"
        neighborhood={neighborhood ?? null}
        locale={locale}
        basePath="/"
      />
    </main>
  )
}
