import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { fetchAllPlaces, type KakaoPlace } from './lib/kakao-client'
import { normalize } from './lib/normalize'
import { upsertDrafts } from './lib/supabase-seed'

const KEYWORDS = ['멕시칸', '타코', '부리또', '멕시코음식']

async function main() {
  const apiKey = process.env.KAKAO_REST_API_KEY
  if (!apiKey) {
    throw new Error('Missing KAKAO_REST_API_KEY in .env.local')
  }

  console.log('Seeding from Kakao Local API...')

  const seenIds = new Set<string>()
  const uniquePlaces: KakaoPlace[] = []

  for (const keyword of KEYWORDS) {
    console.log(`\nFetching: "${keyword}"...`)
    const places = await fetchAllPlaces(keyword, apiKey)
    console.log(`  ${places.length} results`)
    for (const place of places) {
      if (!seenIds.has(place.id)) {
        seenIds.add(place.id)
        uniquePlaces.push(place)
      }
    }
  }

  console.log(`\nUnique places after dedup: ${uniquePlaces.length}`)

  const drafts = uniquePlaces.map(normalize)

  console.log('Upserting to Supabase...')
  const { inserted } = await upsertDrafts(drafts)

  console.log('\nDone!')
  console.log(`  Inserted: ${inserted} new draft rows`)
  console.log(`  Skipped:  ${uniquePlaces.length - inserted} already existed`)
  console.log('\nOpen Supabase → Table Editor → restaurants to review drafts.')
}

main().catch((err: Error) => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
