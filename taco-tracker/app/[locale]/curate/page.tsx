import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { RestaurantList } from '@/components/restaurant-list'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

interface Props {
  params: Promise<{ locale: 'ko' | 'en' }>
  searchParams: Promise<{ neighborhood?: string }>
}

export default async function CuratePage({ params, searchParams }: Props) {
  const { locale } = await params
  const { neighborhood } = await searchParams
  const t = await getTranslations('listing')

  const supabase = createAdminClient()
  const { count } = await supabase
    .from('restaurants')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'draft')

  return (
    <main className="mx-auto w-full px-4 py-8 sm:px-6 sm:py-12 2xl:max-w-[1600px]">
      <div className="mb-4 rounded-md border border-brand-deep bg-bg px-4 py-2 text-sm text-brand-deep">
        {t('curatorBanner', { count: count ?? 0 })}
      </div>
      <h1 className="mb-6 font-display text-3xl text-ink sm:text-4xl">
        {t('curateTitle')}
      </h1>
      <RestaurantList
        status="draft"
        neighborhood={neighborhood ?? null}
        locale={locale}
        basePath="/curate"
      />
    </main>
  )
}
