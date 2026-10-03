# Taco Map design pass 01

This is the first design pass on the existing Next.js app. Beli's mobile screens
informed the simple map/list switch, useful place cards, and a direct path to a
restaurant's details. The colors and editorial typography remain Taco Map's own.

## Included

- A stronger home heading and clearer search presentation in English and Korean.
- A quieter cream, charcoal, deep green, and chili palette.
- Restaurant cards with larger names, photo space, and a clearly identified
  editor's score. The score is not presented as a community rating.
- A single tap/click opens restaurant details. On mobile, details now open over
  the map or list and have a clear back action.
- Restaurant detail hierarchy, larger imagery, clearer directions and share
  actions, and a share link to the specific restaurant page.

## What this pass does not add

Accounts, check-ins, reviews, photo uploads, Taco Feed, and City Hubs need data
models and permissions. The live restaurant source and Kakao map key are not in
this transfer, so this pass was checked by TypeScript and the existing unit
suite but was not visually verified against the live database or map.

## Validation

- `./node_modules/.bin/tsc --noEmit`: passed.
- `./node_modules/.bin/vitest run`: 12 files and 135 tests passed.

## Next implementation decisions

1. Connect this source to the canonical Git repository and preview deployment.
2. Review the real mobile and desktop map with restaurant photos and Kakao Maps.
3. Add structured city data and expand import coverage before City Hubs.
4. Add user accounts, visits, photos, and reviews before building Taco Feed.
