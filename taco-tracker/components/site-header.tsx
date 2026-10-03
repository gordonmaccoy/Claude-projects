'use client'

import { useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { Menu, X, MessageSquare, User, LogOut, Share2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { authLocale, loginPath, safeReturnPath } from '@/lib/auth/redirects'
import { signOutBrowser, watchBrowserSession } from '@/lib/auth/client-session'
import { LogoMark } from './logo-mark'

/**
 * Shows /logo.png if the file exists in public/, otherwise falls back to the
 * inline SVG <LogoMark />. Drop logo.png into taco-tracker/public/ to activate.
 */
function LogoImage({ className }: { className?: string }) {
  const [err, setErr] = useState(false)
  if (err) return <LogoMark className={className} />
  return (
    <img
      src="/logo.png"
      alt=""
      className={className}
      style={{ objectFit: 'contain' }}
      onError={() => setErr(true)}
    />
  )
}

export function SiteHeader() {
  const t = useTranslations('header')
  const tAuth = useTranslations('auth')
  const [open, setOpen] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState(false)
  const locale = authLocale(useLocale())
  const pathname = usePathname()
  const router = useRouter()
  const returnTo = safeReturnPath(pathname, locale)
  const signInUrl = `${loginPath(locale)}?${new URLSearchParams({ next: returnTo })}`

  useEffect(() => {
    try {
      return watchBrowserSession(createClient(), (authenticated) => {
        setSignedIn(authenticated)
        setSessionReady(true)
      })
    } catch {
      setSessionReady(true)
    }
  }, [])

  async function handleLogout() {
    setLoggingOut(true)
    setLogoutError(false)
    try {
      await signOutBrowser(createClient())
      setSignedIn(false)
      setOpen(false)
      router.refresh()
    } catch {
      setLogoutError(true)
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-ink/10 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
        <div className="mx-auto flex w-full items-center justify-between gap-4 px-4 py-3 sm:px-6 2xl:max-w-[1600px]">
          <Link href="/" className="flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-md">
            <LogoImage className="h-9 w-9" />
            <div className="flex flex-col leading-tight">
              <span className="font-display text-xl leading-none tracking-[-0.04em] text-ink sm:text-2xl">Taco Map<span className="text-brand">.</span></span>
              <span className="mt-1 hidden text-[10px] font-medium uppercase tracking-[0.12em] text-muted sm:block">{t('tagline')}</span>
            </div>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {sessionReady ? signedIn ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-deep/15 bg-bg px-3 py-2 text-xs font-medium text-brand-deep"><User className="h-4 w-4" />{tAuth('signedIn')}</span>
            ) : (
              <a href={signInUrl} className="rounded-full bg-brand-deep px-4 py-2 text-sm font-semibold text-white hover:bg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">{tAuth('signIn')}</a>
            ) : null}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t('menuLabel')}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/10 text-ink hover:bg-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Menu className="h-5 w-5" />
          </button>
          </div>
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-50 flex">
          <div
            onClick={() => setOpen(false)}
            className="flex-1 bg-ink/40 backdrop-blur-sm"
            aria-hidden
          />
          <aside className="flex w-[280px] flex-col gap-4 overflow-y-auto bg-surface p-4 shadow-[-4px_0_16px_rgba(27,25,22,0.18)]">
            <div className="flex items-center justify-between">
              <span className="font-display text-lg text-ink">Taco Map</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('closeMenu')}
                className="flex h-8 w-8 items-center justify-center rounded-md text-ink hover:bg-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <SidebarSection label={t('platform')}>
              <SidebarLink href="/" onClick={() => setOpen(false)}>{t('platformLinks.tacoMap')}</SidebarLink>
              <SidebarPlaceholder>{t('platformLinks.tacoFeed')}</SidebarPlaceholder>
              <SidebarPlaceholder>{t('platformLinks.tacoHub')}</SidebarPlaceholder>
              <SidebarPlaceholder>{t('platformLinks.tacoSpecials')}</SidebarPlaceholder>
              <SidebarPlaceholder icon={<MessageSquare className="h-4 w-4" />}>{t('platformLinks.feedback')}</SidebarPlaceholder>
            </SidebarSection>

            <SidebarSection label={t('partner')}>
              <SidebarPlaceholder>{t('partnerLinks.partnerships')}</SidebarPlaceholder>
            </SidebarSection>

            <SidebarSection label={t('account')}>
              {!sessionReady ? <p className="px-2 text-sm text-muted">{tAuth('loading')}</p> : signedIn ? (
                <>
                  <p className="flex items-center gap-2 px-2 py-1.5 text-sm text-brand-deep"><User className="h-4 w-4" />{tAuth('signedIn')}</p>
                  <SidebarPlaceholder icon={<User className="h-4 w-4" />}>{t('accountLinks.profile')}</SidebarPlaceholder>
                  <button type="button" onClick={handleLogout} disabled={loggingOut} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-ink hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"><LogOut className="h-4 w-4" />{loggingOut ? tAuth('loggingOut') : t('accountLinks.logout')}</button>
                </>
              ) : (
                <a href={signInUrl} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"><User className="h-4 w-4" />{tAuth('signIn')}</a>
              )}
              {logoutError ? <p role="alert" className="px-2 text-xs text-brand">{tAuth('logoutError')}</p> : null}
            </SidebarSection>

            <SidebarSection label={t('follow')}>
              <SidebarPlaceholder icon={<Share2 className="h-4 w-4" />}>Instagram</SidebarPlaceholder>
            </SidebarSection>
          </aside>
        </div>
      ) : null}
    </>
  )
}

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="px-2 pt-2 text-[10px] font-medium uppercase tracking-wide text-muted">{label}</div>
      {children}
    </div>
  )
}

function SidebarLink({
  href,
  onClick,
  children,
  icon,
}: {
  href: '/' | '/curate'
  onClick?: () => void
  children: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      {icon}
      <span>{children}</span>
    </Link>
  )
}

function SidebarPlaceholder({
  children,
  icon,
}: {
  children: React.ReactNode
  icon?: React.ReactNode
}) {
  const t = useTranslations('header')
  return (
    <button
      type="button"
      disabled
      className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted"
      title={t('comingSoon')}
    >
      <span className="flex items-center gap-2">
        {icon}
        <span>{children}</span>
      </span>
      <span className="text-[10px] uppercase tracking-wide">{t('comingSoon')}</span>
    </button>
  )
}
