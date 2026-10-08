interface Props {
  color: string
  size?: number
}

export function CategoryDot({ color, size = 6 }: Props) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        flexShrink: 0
      }}
    />
  )
}
