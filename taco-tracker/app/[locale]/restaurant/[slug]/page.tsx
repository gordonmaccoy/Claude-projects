import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRestaurantBySlug } from '@/lib/restaurants'
import { RestaurantDetail } from '@/components/restaurant-detail'

interface Props {
  params: Promise<{ locale: 'ko' | 'en'; slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params
  const supabase = await createClient()
  let restaurant = await getRestaurantBySlug(supabase, slug)
  if (!restaurant) {
    restaurant = await getRestaurantBySlug(createAdminClient(), slug)
    if (restaurant) {
      return {
        title: restaurant.name_ko,
        robots: { index: false, follow: false },
      }
    }
  }
  if (!restaurant) return { title: 'Taco Map' }
  const name =
    locale === 'en' ? (restaurant.name_en ?? restaurant.name_ko) : restaurant.name_ko
  return {
    title: `${name} · Taco Map`,
    description: restaurant.address_ko,
  }
}

export default async function RestaurantPage({ params }: Props) {
  const { slug, locale } = await params
  const supabase = await createClient()
  let restaurant = await getRestaurantBySlug(supabase, slug)
  if (!restaurant) {
    restaurant = await getRestaurantBySlug(createAdminClient(), slug)
  }
  if (!restaurant) notFound()
  return <RestaurantDetail restaurant={restaurant} locale={locale} />
}
