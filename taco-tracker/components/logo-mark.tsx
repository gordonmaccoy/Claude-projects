interface Props {
  className?: string
}

export function LogoMark({ className }: Props) {
  return (
    <svg
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M 16 2 C 9 2 4 8 4 14 C 4 22 16 30 16 30 C 16 30 28 22 28 14 C 28 8 23 2 16 2 Z"
        fill="#C84B2F"
        stroke="#3B2A1F"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M 10 13 Q 16 17 22 13"
        fill="none"
        stroke="#FFFBF2"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="12.5" cy="11" r="1" fill="#FFFBF2" />
      <circle cx="19.5" cy="11" r="1" fill="#FFFBF2" />
    </svg>
  )
}
