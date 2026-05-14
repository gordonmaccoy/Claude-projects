'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'

interface Props {
  photos: string[]
}

export function PhotoGallery({ photos }: Props) {
  const t = useTranslations('detail')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [active, setActive] = useState<string | null>(null)

  if (photos.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">{t('noPhotos')}</p>
  }

  const open = (src: string) => {
    setActive(src)
    dialogRef.current?.showModal()
  }
  const close = () => {
    dialogRef.current?.close()
    setActive(null)
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((src) => (
          <li key={src}>
            <button
              type="button"
              onClick={() => open(src)}
              className="block aspect-square w-full overflow-hidden rounded-md bg-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className="h-full w-full object-cover transition-transform hover:scale-105"
                loading="lazy"
              />
            </button>
          </li>
        ))}
      </ul>
      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) close()
        }}
        onCancel={(e) => {
          e.preventDefault()
          close()
        }}
        className="m-auto max-h-[90vh] max-w-[90vw] rounded-lg bg-surface p-0 backdrop:bg-black/70"
      >
        {active ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={active} alt="" className="max-h-[90vh] max-w-[90vw] object-contain" />
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-surface/95 text-ink shadow-card"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : null}
      </dialog>
    </>
  )
}
