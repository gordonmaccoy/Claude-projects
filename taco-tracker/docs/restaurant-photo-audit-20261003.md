# Restaurant photo audit

Inventory: Taco Map public listing snapshot from 3 October 2026. Reachability checked at 00:17 KST on 4 October 2026 (2026-10-03 15:17 UTC). The archived fictional building was excluded, leaving 147 restaurants.

## Result

| Check | Result |
| --- | --- |
| Restaurant cover URLs tested | 147 |
| Covers responding HTTP 200 with an image content type | 146 |
| Failed covers | 1 |
| Additional fallback URLs tested for the failed cover | 3 |
| Total unique URLs tested | 150 |
| Failed cover or fallback URLs | 4, all HTTP 403 |

The failing restaurant is **Taco Taco**, slug `place-346172199`, currently listed at 경기 용인시 처인구 남사읍 한숲로 45. Its four distinct stored sources, including the cover, all returned HTTP 403. The existing shared photo component therefore reaches its localized “Photo unavailable” placeholder.

None of the other 146 covers failed in this pass. Their backup URLs were not tested. The complete stored source set contains 1,165 distinct URLs; the nonessential full-source scan was discontinued in favor of checking covers and the failed restaurant's backups.

## Method and limits

Requests used HTTP HEAD to inspect status and content type. Ambiguous 403 or 405 results were retried with a limited GET request, reading at most 16 response bytes. No image collection was downloaded or copied. No database or UI changes were made for this audit.

Reachability is a point-in-time server check. It does not prove that an image decodes in every browser, that the image depicts the correct restaurant, or that Taco Map has permission to republish it. All 147 current cover URLs use the same Kakao CDN host, so the existing fallback chain still depends on that provider. A fallback cannot guarantee recovery from a provider-wide block.

The previously reported Burrito King, Booth Burrito, Via Guerrero and Bittle's Taco covers responded successfully during this pass. The earlier user's broken-image screenshot remains consistent with intermittent loading failure, even though this scan does not reproduce it.

## Taco Taco replacement decision

Focused searches using the listed Korean name, Yongin/Namsa locality, street address and phone number did not identify a confirmed owner website or an explicitly licensed replacement image. This is an unresolved search result, not evidence that the venue has closed.

1. Confirm the restaurant's identity and current operating status as part of the separate directory audit.
2. Keep the neutral placeholder while that check is unresolved.
3. If the listing is confirmed, replace its cover with an original photo submitted by the owner, a user, or the curator, with recorded permission to display it on Taco Map.
4. If the listing is independently confirmed closed or incorrectly identified, correct the listing rather than filling it with an unrelated taco photo.

No existing map-review photo or Instagram photo has been selected for copying. No replacement photo with documented reuse permission was found or published.

## Sustainable approach

The fastest practical improvement is a curator upload field for restaurant covers. A full restaurant account and self-service portal can follow later.

- Accept original venue photos and record the uploader, restaurant, credit, permission basis, submission date and moderation decision.
- Store approved originals and generated display sizes in Taco Map's own storage. Do not merely proxy or copy existing third-party URLs into that storage without permission.
- Use a private pending-upload area and restricted write access. Publish approved display copies separately. Supabase Storage supports access controls through Row Level Security, but a public bucket alone does not provide moderation.
- Generate appropriately sized JPEG/WebP files during upload to limit bandwidth. Supabase's on-demand image transformations are available on Pro plans and above, so they should be optional rather than a requirement for a low-cost first version.
- Select a real, approved photo as the cover. Retain the current fallback component for ordinary network errors.
- Record photo failure events by restaurant and review repeated failures. Avoid routinely crawling all backup images.
- Use a neutral illustration or the existing camera placeholder where no approved image exists. A generic stock food photo can misrepresent the restaurant and should not stand in for a venue photo.

## Sources

- Existing `components/restaurant-photo.tsx`: source deduplication, sequential error fallback and localized final placeholder.
- Existing public Taco Map inventory snapshot: restaurant identifiers and stored source URLs. No new third-party image metadata is reproduced here.
- [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control): Storage upload policies and Row Level Security.
- [Supabase image transformations](https://supabase.com/docs/guides/storage/serving/image-transformations): optional image sizing/optimization and Pro-plan requirement, checked 4 October 2026 KST.
