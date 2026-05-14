import { getTranslations } from 'next-intl/server'
import { RestaurantList } from '@/components/restaurant-list'

interface Props {
  params: Promise<{ locale: 'ko' | 'en' }>
  searchParams: Promise<{
    neighborhood?: string
    dish?: string
    dietary?: string
  }>
}

export default async function HomePage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams
  const t = await getTranslations('listing')

  return (
    <main className="mx-auto w-full px-4 py-6 sm:px-6 sm:py-8 2xl:max-w-[1600px]">
      <h1 className="mb-4 font-display text-3xl text-ink sm:text-4xl">
        {t('title')}
      </h1>
      <RestaurantList
        status="live"
        neighborhood={sp.neighborhood ?? null}
        dish={sp.dish ?? null}
        dietary={sp.dietary ?? null}
        locale={locale}
        basePath="/"
      />
    </main>
  )
}
