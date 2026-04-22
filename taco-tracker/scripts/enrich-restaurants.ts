import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { buildEnrichment, computeDiff } from './lib/enrich'
import type { RestaurantRow } from './lib/enrich'

const DRY_RUN = process.argv.includes('--dry-run')
const BATCH_SIZE = 50

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key)
}

async function fetchDraftRows(supabase: ReturnType<typeof getSupabase>): Promise<RestaurantRow[]> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name_ko, name_en, dish_tags, has_vegan_options, has_vegetarian_options, is_halal')
    .eq('status', 'draft')
  if (error) throw new Error(`Failed to fetch rows: ${error.message}`)
  return (data ?? []) as RestaurantRow[]
}

async function writeBatch(
  supabase: ReturnType<typeof getSupabase>,
  updates: { id: string; [key: string]: unknown }[]
): Promise<void> {
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('restaurants').upsert(batch, { onConflict: 'id' })
    if (error) throw new Error(`Upsert failed: ${error.message}`)
    console.log(`  wrote batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} rows)`)
  }
}

async function main() {
  console.log(`Enrichment run — mode: ${DRY_RUN ? 'DRY RUN' : 'WRITE'}`)

  const supabase = getSupabase()
  const rows = await fetchDraftRows(supabase)
  console.log(`Fetched ${rows.length} draft rows`)

  const updates: { id: string; [key: string]: unknown }[] = []
  const noEnglishName: string[] = []
  const noTags: string[] = []

  for (const row of rows) {
    const patch = buildEnrichment(row)
    const diff = computeDiff(row, patch)

    if (Object.keys(diff).length > 0) {
      updates.push({ id: row.id, ...diff })
    }

    const finalNameEn = diff.name_en !== undefined ? diff.name_en : row.name_en
    const finalTags = diff.dish_tags !== undefined ? diff.dish_tags : row.dish_tags

    if (!finalNameEn) noEnglishName.push(row.name_ko)
    if (!finalTags || finalTags.length === 0) noTags.push(row.name_ko)
  }

  console.log(`\nEnrichment results:`)
  console.log(`  rows with changes: ${updates.length}`)
  console.log(`  rows needing name_en review: ${noEnglishName.length}`)
  console.log(`  rows needing dish_tags review: ${noTags.length}`)

  if (DRY_RUN) {
    console.log('\n--- DRY RUN: would write these updates ---')
    for (const u of updates.slice(0, 10)) console.log(JSON.stringify(u))
    if (updates.length > 10) console.log(`  ... and ${updates.length - 10} more`)
    console.log('\n--- Rows needing name_en review (first 10) ---')
    noEnglishName.slice(0, 10).forEach(n => console.log(' ', n))
    console.log('\n--- Rows needing dish_tags review (first 10) ---')
    noTags.slice(0, 10).forEach(n => console.log(' ', n))
    return
  }

  if (updates.length === 0) {
    console.log('Nothing to update.')
    return
  }

  await writeBatch(supabase, updates)
  console.log(`\nDone. Updated ${updates.length} rows.`)

  if (noEnglishName.length > 0) {
    console.log(`\n--- Needs manual name_en (${noEnglishName.length} rows) ---`)
    noEnglishName.forEach(n => console.log(' ', n))
  }
  if (noTags.length > 0) {
    console.log(`\n--- Needs manual dish_tags (${noTags.length} rows) ---`)
    noTags.forEach(n => console.log(' ', n))
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
