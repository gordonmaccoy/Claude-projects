import { RestaurantList } from '@/components/restaurant-list'

interface Props {
  params: Promise<{ locale: 'ko' | 'en' }>
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params
  return (
    <main className="mx-auto w-full px-4 py-3 sm:px-6 sm:py-4 2xl:max-w-[1600px]">
      <RestaurantList status="live" locale={locale} />
    </main>
  )
}
