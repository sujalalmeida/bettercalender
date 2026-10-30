import type { InkDocument, InkPage } from '../db/types'
import { drawInkPage, INK_HEIGHT, INK_WIDTH } from './ink'

async function pageBlob(page: InkPage): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = INK_WIDTH * 2; canvas.height = INK_HEIGHT * 2
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Image export is unavailable in this browser.')
  ctx.scale(2, 2); drawInkPage(ctx, page)
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  canvas.width = 0; canvas.height = 0
  if (!blob) throw new Error('The page could not be exported.')
  return blob
}
export async function exportInkImage(page: InkPage, filename: string): Promise<void> {
  const url = URL.createObjectURL(await pageBlob(page))
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export async function printInkDocument(ink: InkDocument): Promise<void> {
  const iframe = document.createElement('iframe')
  iframe.title = 'Handwritten notes print preview'
  iframe.style.cssText = 'position:fixed;width:1px;height:1px;left:-10000px;top:0;border:0'
  document.body.appendChild(iframe)
  const urls: string[] = []
  const cleanup = () => { iframe.remove(); urls.forEach(url => URL.revokeObjectURL(url)) }
  try {
    const doc = iframe.contentDocument
    if (!doc) throw new Error('Print preview is unavailable.')
    const style = doc.createElement('style')
    style.textContent = '@page{size:A4;margin:10mm}body{margin:0}img{display:block;width:100%;height:calc(277mm - 1px);object-fit:contain;page-break-after:always}img:last-child{page-break-after:auto}'
    doc.head.appendChild(style); doc.title = `Notes ${ink.date}`
    for (const page of ink.pages) {
      const url = URL.createObjectURL(await pageBlob(page)); urls.push(url)
      const image = doc.createElement('img'); image.alt = `Notes page ${urls.length}`; image.src = url
      doc.body.appendChild(image); await image.decode()
    }
    iframe.contentWindow?.addEventListener('afterprint', cleanup, { once:true })
    iframe.contentWindow?.focus(); iframe.contentWindow?.print()
    setTimeout(cleanup, 300000)
  } catch (error) { cleanup(); throw error }
}
