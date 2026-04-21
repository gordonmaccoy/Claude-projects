import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['ko', 'en'] as const,
  defaultLocale: 'ko',
  localePrefix: 'as-needed', // / serves Korean; /en serves English
})
