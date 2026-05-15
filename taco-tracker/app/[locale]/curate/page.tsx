import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { RestaurantList } from '@/components/restaurant-list'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

interface Props {
  params: Promise<{ locale: 'ko' | 'en' }>
}

export default async function CuratePage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations('listing')

  const supabase = createAdminClient()
  const { count } = await supabase
    .from('restaurants')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'draft')

  return (
    <main className="mx-auto w-full px-4 py-4 sm:px-6 sm:py-6 2xl:max-w-[1600px]">
      <div className="mb-3 rounded-md border border-brand-deep bg-bg px-4 py-2 text-sm text-brand-deep">
        {t('curatorBanner', { count: count ?? 0 })}
      </div>
      <h1 className="mb-3 font-display text-2xl text-ink sm:text-3xl">{t('curateTitle')}</h1>
      <RestaurantList status="draft" locale={locale} />
    </main>
  )
}
