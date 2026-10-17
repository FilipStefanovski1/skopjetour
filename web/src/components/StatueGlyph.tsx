/** Stand-in for a statue with no photo yet: a figure on a plinth. */
export function StatueGlyph({ size = 34 }: { size?: number }) {
  return (
    <svg className="glyph" viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <circle cx="12" cy="6.2" r="2.6" />
      <path d="M8.6 20v-6.2c0-2.3 1.5-4.4 3.4-4.4s3.4 2.1 3.4 4.4V20z" />
      <path d="M6.5 20h11v1.6h-11z" />
    </svg>
  )
}
