import { createClient } from '@supabase/supabase-js'
import type { RestaurantDraft } from './normalize'

const BATCH_SIZE = 50

export async function upsertDrafts(
  drafts: RestaurantDraft[]
): Promise<{ inserted: number }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment'
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  let inserted = 0

  for (let i = 0; i < drafts.length; i += BATCH_SIZE) {
    const batch = drafts.slice(i, i + BATCH_SIZE)
    const { data, error } = await supabase
      .from('restaurants')
      .upsert(batch, { onConflict: 'kakao_place_id', ignoreDuplicates: true })
      .select('id')
    if (error) throw new Error(`Supabase upsert failed: ${error.message}`)
    inserted += data?.length ?? 0
  }

  return { inserted }
}
