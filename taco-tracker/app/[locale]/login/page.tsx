import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getAuthProviders } from '@/lib/auth/providers'
import { authLocale, safeReturnPath } from '@/lib/auth/redirects'

export const dynamic = 'force-dynamic'

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const [{ locale: rawLocale }, query, providers, t] = await Promise.all([
    params, searchParams, getAuthProviders(), getTranslations('auth'),
  ])
  const locale = authLocale(rawLocale)
  const next = safeReturnPath(query.next, locale)
  const error = ['failed', 'cancelled', 'unavailable', 'notEnabled'].includes(query.error ?? '') ? query.error : null
  return (
    <main className="mx-auto max-w-lg px-4 py-12 sm:py-20">
      <div className="rounded-[28px] border border-ink/10 bg-surface p-6 shadow-card sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-deep">Taco Map</p>
        <h1 className="mt-3 font-display text-4xl tracking-tight text-ink">{t('title')}</h1>
        <p className="mt-4 text-sm leading-7 text-muted">{t('description')}</p>
        {error ? <p role="alert" className="mt-5 rounded-xl border border-brand/20 bg-bg p-3 text-sm text-ink">{t(`errors.${error}`)}</p> : null}
        {!providers || (!providers.google && !providers.kakao) ? (
          <p className="mt-5 rounded-xl bg-bg p-3 text-sm text-muted">{t(!providers ? 'errors.unavailable' : 'setupPending')}</p>
        ) : null}
        <div className="mt-6 flex flex-col gap-3">
          {(['google', 'kakao'] as const).map((provider) => (
            <form key={provider} action="/auth/signin" method="post">
              <input type="hidden" name="provider" value={provider} />
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="next" value={next} />
              <button type="submit" disabled={!providers?.[provider]} className={`flex min-h-12 w-full items-center justify-center gap-3 rounded-full border px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50 ${provider === 'kakao' ? 'border-[#FEE500] bg-[#FEE500] text-[#191919] hover:bg-[#F4DC00]' : 'border-ink/15 bg-white text-ink hover:bg-bg'}`}>
                {t(provider === 'google' ? 'google' : 'kakao')}
              </button>
            </form>
          ))}
        </div>
        {providers && providers.google !== providers.kakao ? <p className="mt-3 text-xs leading-5 text-muted">{t('someProvidersPending')}</p> : null}
        <p className="mt-6 text-xs leading-6 text-muted">{t('privacy')}</p>
        <Link href="/" className="mt-6 inline-block text-sm font-medium text-brand-deep underline underline-offset-4">{t('browse')}</Link>
      </div>
    </main>
  )
}
