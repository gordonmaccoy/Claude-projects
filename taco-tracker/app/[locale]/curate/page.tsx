import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { RestaurantList } from '@/components/restaurant-list'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

interface Props {
  params: Promise<{ locale: 'ko' | 'en' }>
  searchParams: Promise<{
    neighborhood?: string
    dish?: string
    dietary?: string
  }>
}

export default async function CuratePage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams
  const t = await getTranslations('listing')

  const supabase = createAdminClient()
  const { count } = await supabase
    .from('restaurants')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'draft')

  return (
    <main className="mx-auto w-full px-4 py-6 sm:px-6 sm:py-8 2xl:max-w-[1600px]">
      <div className="mb-4 rounded-md border border-brand-deep bg-bg px-4 py-2 text-sm text-brand-deep">
        {t('curatorBanner', { count: count ?? 0 })}
      </div>
      <h1 className="mb-4 font-display text-3xl text-ink sm:text-4xl">
        {t('curateTitle')}
      </h1>
      <RestaurantList
        status="draft"
        neighborhood={sp.neighborhood ?? null}
        dish={sp.dish ?? null}
        dietary={sp.dietary ?? null}
        locale={locale}
        basePath="/curate"
      />
    </main>
  )
}
