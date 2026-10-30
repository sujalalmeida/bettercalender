import { describe, expect, it, vi } from 'vitest'
import type { InkStroke } from '../db/types'
import { appendStroke, blankInkDocument, eraseInkAt, lassoStrokes, shapePoints, transformStrokes } from './ink'
import { InkRenderer } from './inkRenderer'
const line: InkStroke = { id:'line', size:4, color:'#000000', points:[{x:100,y:100,pressure:.5},{x:300,y:100,pressure:.8}] }
describe('vector editing', () => {
  it('splits a sparse line when partially erased and preserves its pressure', () => {
    const doc = appendStroke(blankInkDocument('2026-11-05'),0,line)
    const next = eraseInkAt(doc,0,{x:200,y:100,pressure:.5},10)
    expect(next.pages[0].strokes).toHaveLength(2)
    expect(next.pages[0].strokes[0].points[1].x).toBeCloseTo(188)
    expect(next.pages[0].strokes[1].points[0].x).toBeCloseTo(212)
    expect(next.pages[0].strokes[1].points[0].pressure).toBeGreaterThan(.5)
    expect(doc.pages[0].strokes).toHaveLength(1)
    expect(eraseInkAt(doc,0,{x:800,y:800,pressure:.5},10)).toBe(doc)
  })
  it('selects crossing strokes even if neither endpoint lies inside the lasso', () => {
    const polygon = [[180,80],[220,80],[220,120],[180,120]].map(([x,y])=>({x,y,pressure:.5}))
    expect(lassoStrokes({id:'page',strokes:[line]},polygon)).toEqual(['line'])
  })
  it('moves and duplicates a selection without clipping or reusing IDs', () => {
    const moved=transformStrokes([line],-1000,2000)
    expect(moved[0].points.map(p=>p.x)).toEqual([0,200])
    expect(moved[0].points.every(p=>p.y<=1400)).toBe(true)
    const copy=transformStrokes([line],20,20,1,true)
    expect(copy[0].id).not.toBe(line.id)
    expect(line.points[0].x).toBe(100)
    expect(shapePoints('rectangle',line.points[0],line.points[1])).toHaveLength(5)
  })
})
describe('layered drawing renderer', () => {
  it('does not repaint historical ink while drawing active samples or predictions', () => {
    const make = () => {
      const ctx = Object.fromEntries(['setTransform','clearRect','fillRect','save','restore','beginPath','arc','fill','moveTo','lineTo','stroke','closePath','setLineDash','strokeRect'].map(name=>[name,vi.fn()]))
      return { width:0,height:0,style:{},getContext:()=>ctx,ctx }
    }
    const base=make(),active=make(),feedback=make()
    const renderer=new InkRenderer(base as unknown as HTMLCanvasElement,active as unknown as HTMLCanvasElement,feedback as unknown as HTMLCanvasElement)
    renderer.resize(860,1204,2)
    renderer.page({id:'page',strokes:[line]})
    const historicalCalls=base.ctx.fill.mock.calls.length
    for(let i=0;i<20;i++) { renderer.stroke(line);renderer.overlay(line) }
    expect(base.ctx.fill).toHaveBeenCalledTimes(historicalCalls)
    expect(active.ctx.fill).toHaveBeenCalledTimes(20)
    expect(feedback.ctx.fill).toHaveBeenCalledTimes(20)
    renderer.resize(4000,5600,3)
    expect(base.width).toBe(2000)
  })
})
