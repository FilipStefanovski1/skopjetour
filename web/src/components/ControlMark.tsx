interface Props {
  kind: 'start' | 'control' | 'plain'
  n?: number
  seen: boolean
}

/**
 * The course symbol for a row: start triangle, numbered control circle, or a plain control
 * circle. A statue the visitor has seen is punched: its symbol fills with course purple.
 */
export function ControlMark({ kind, n, seen }: Props) {
  return (
    <span className={`mark mark--${kind}${seen ? ' mark--seen' : ''}`} aria-hidden>
      <svg viewBox="0 0 32 32" width="32" height="32">
        {kind === 'start' ? <path d="M16 4.5 28.5 26.5h-25z" /> : <circle cx="16" cy="16" r={kind === 'plain' ? 8 : 12.5} />}
        {seen && kind === 'plain' && <path className="mark__tick" d="M12.6 16.2l2.4 2.4 4.5-4.9" />}
      </svg>
      {kind !== 'plain' && n !== undefined && <span className="mark__n">{n}</span>}
    </span>
  )
}
