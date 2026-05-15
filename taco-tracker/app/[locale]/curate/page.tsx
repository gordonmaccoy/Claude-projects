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
    <main className="mx-auto w-full px-4 py-3 sm:px-6 sm:py-4 2xl:max-w-[1600px]">
      <div className="mb-2 rounded-md border border-brand-deep bg-bg px-3 py-1.5 text-xs text-brand-deep">
        {t('curatorBanner', { count: count ?? 0 })}
      </div>
      <h1 className="mb-2 font-display text-lg text-ink sm:text-xl">{t('curateTitle')}</h1>
      <RestaurantList status="draft" locale={locale} />
    </main>
  )
}
