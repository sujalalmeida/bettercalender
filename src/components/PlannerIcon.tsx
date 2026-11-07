const paths = {
  pen: 'M13.5 6.5l4 4M4 20l4.5-1 12-12a2.8 2.8 0 0 0-4-4l-12 12L4 20Z',
  pencil: 'M3 21l2-6L17 3l4 4L9 19l-6 2Zm12-16 4 4',
  highlighter: 'm5 14 9-10 5 5-9 10H5v-5Zm0 5-2 2h6m4-15 5 5',
  eraser: 'm4 13 8-9a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3l-7 8H9l-5-5a1.5 1.5 0 0 1 0-2Zm4-4 8 8m-5 3h10',
  lasso: 'M8 15c-4 0-6-2-6-5s4-6 10-6 10 2 10 6-4 6-10 6c-5 0-6 2-4 4 1 1 4 1 4-1 0-2-2-4-4-4Z',
  shape: 'M3 4h10v10H3Zm12 4a6 6 0 1 1-7 8',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v6m4-6v6',
  download: 'M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4',
  print: 'M6 8V3h12v5M6 17H3V8h18v9h-3M6 14h12v7H6Zm11-3h1',
  undo: 'M4 10a8 8 0 1 1 1 7m-1-7V4m0 6h6',
  redo: 'M20 10a8 8 0 1 0-1 7m1-7V4m0 6h-6'
}

export function PlannerIcon({ name }: { name: keyof typeof paths }) {
  return <svg class="planner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
