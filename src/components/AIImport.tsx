import { useEffect, useRef, useState } from 'preact/hooks'
import type { Suggestion } from '../lib/geminiSuggestions'
import { saveMilestone, saveRevision, saveSkill, type MilestoneInput, type RevisionInput, type SkillInput } from '../db/learningRepository'

type Target = 'revision' | 'skills' | 'milestones'
const allowed = ['image/jpeg','image/png','image/webp','application/pdf','audio/webm','audio/mp4','audio/mpeg']
const MAX_FILE = 8 * 1024 * 1024
function toBase64(file: Blob): Promise<string> { return new Promise((resolve,reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error('Could not read this file.')); reader.onload = () => resolve(String(reader.result).split(',')[1] || ''); reader.readAsDataURL(file) }) }
export default function AIImport({ target, onClose }: { target: Target; onClose: () => void }) {
  const [note,setNote] = useState('')
  const [file,setFile] = useState<File | null>(null)
  const [suggestions,setSuggestions] = useState<Suggestion[]>([])
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [recording,setRecording] = useState(false)
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  useEffect(() => () => { if (recorder.current?.state === 'recording') recorder.current.stop(); stream.current?.getTracks().forEach(t => t.stop()) }, [])
  async function record() {
    if (recording) { recorder.current?.stop(); setRecording(false); return }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setError('Recording is unavailable here. Use the keyboard microphone to dictate into the note box.'); return }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = ['audio/mp4','audio/webm'].find(x => MediaRecorder.isTypeSupported(x))
      const chunks: Blob[] = []
      const rec = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined)
      recorder.current = rec
      rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
      rec.onstop = () => { const blob = new Blob(chunks,{type: rec.mimeType || 'audio/mp4'}); stream.current?.getTracks().forEach(t => t.stop()); if (blob.size > MAX_FILE) setError('Recording is too large. Please keep it under 8 MB.'); else setFile(new File([blob], 'dictation', {type: blob.type})); setRecording(false) }
      rec.start(); setRecording(true)
      setTimeout(() => { if (rec.state === 'recording') rec.stop() }, 60000)
    } catch { setError('Microphone access was denied. You can still dictate using the keyboard microphone.') }
  }
  async function analyze() {
    setError(''); if (!note.trim() && !file) { setError('Add a note, dictation or file first.'); return }
    if (file && (file.size > MAX_FILE || !allowed.includes(file.type))) { setError('Choose a JPEG, PNG, WebP, PDF or supported recording under 8 MB.'); return }
    setBusy(true)
    try {
      const input = file ? { mimeType: file.type, data: await toBase64(file) } : undefined
      const { generateSuggestions } = await import('../lib/geminiSuggestions')
      const result = await generateSuggestions(target,note,input)
      if (!result.length) setError('No clear entries found. Add a little more detail or use the manual form.')
      setSuggestions(result)
    } catch (e) { setError(e instanceof Error ? e.message : 'Gemini could not analyze this. Please try again.') }
    finally { setBusy(false) }
  }
  async function save(index: number) {
    setError('')
    try {
      const item = suggestions[index]
      if (target === 'revision') await saveRevision(item as RevisionInput)
      if (target === 'skills') await saveSkill(item as SkillInput)
      if (target === 'milestones') await saveMilestone(item as MilestoneInput)
      setSuggestions(suggestions.filter((_,i) => i !== index))
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save suggestion.') }
  }
  function update(index: number, patch: Record<string, unknown>) { setSuggestions(suggestions.map((x,i) => i === index ? { ...x, ...patch } as Suggestion : x)) }
  return <section class="workspace-ai"><div class="workspace-form-head"><h2>Suggest fields with Gemini</h2><button onClick={onClose} aria-label="Close Gemini">✕</button></div><p>Type or dictate a note, or upload an exam schedule or syllabus. Gemini suggests entries for you to check and edit before saving.</p><p class="workspace-privacy">Only use this with non-sensitive study or admin information. Do not include patient details or private diary notes. Your note or file is sent to Google when you tap Analyze.</p>
    <label>Note or iPad keyboard dictation<textarea value={note} onInput={e => setNote(e.currentTarget.value)} placeholder="e.g. I need to revise heart failure. Elective application due 12 March…" /></label>
    <div class="workspace-ai-inputs"><button type="button" class="workspace-secondary" onClick={record}>{recording ? '■ Stop recording' : '● Record dictation'}</button><label class="workspace-file">Upload image, PDF or audio<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,audio/mp4,audio/webm,audio/mpeg" onChange={e => setFile(e.currentTarget.files?.[0] ?? null)} /></label></div>
    {file && <p class="workspace-muted">Selected: {file.name} <button onClick={() => setFile(null)}>Remove</button></p>}
    <button class="workspace-primary" disabled={busy || recording} onClick={analyze}>{busy ? 'Analyzing…' : 'Analyze and suggest'}</button>
    {error && <p class="workspace-error" role="alert">{error}</p>}
    {suggestions.length > 0 && <div class="workspace-suggestions"><h3>Review suggestions</h3>{suggestions.map((item,index) => <article class="workspace-card" key={index}><div class="workspace-fields">
      <label>Title<input value={item.title} onInput={e => update(index,{title:e.currentTarget.value})} /></label>
      {target === 'revision' && <><label>Subject<input value={(item as RevisionInput).subject} onInput={e => update(index,{subject:e.currentTarget.value})} /></label><label>Why missed<textarea value={(item as RevisionInput).reason} onInput={e => update(index,{reason:e.currentTarget.value})} /></label><label>Takeaway<textarea value={(item as RevisionInput).takeaway} onInput={e => update(index,{takeaway:e.currentTarget.value})} /></label><label>Source<input value={(item as RevisionInput).source} onInput={e => update(index,{source:e.currentTarget.value})} /></label><label>Confidence<select value={(item as RevisionInput).confidence} onChange={e => update(index,{confidence:Number(e.currentTarget.value)})}>{[1,2,3].map(x => <option value={x}>{x}</option>)}</select></label><label>Review date<input type="date" value={(item as RevisionInput).nextReviewDate} onInput={e => update(index,{nextReviewDate:e.currentTarget.value})} /></label></>}
      {target === 'skills' && <><label>Type<select value={(item as SkillInput).kind} onChange={e => update(index,{kind:e.currentTarget.value})}><option value="learning">Learned</option><option value="practice">Practised</option></select></label><label>Rotation<input value={(item as SkillInput).rotation} onInput={e => update(index,{rotation:e.currentTarget.value})} /></label><label>Note<textarea value={(item as SkillInput).note} onInput={e => update(index,{note:e.currentTarget.value})} /></label><label>Next step<input value={(item as SkillInput).nextStep} onInput={e => update(index,{nextStep:e.currentTarget.value})} /></label><label>Confidence<select value={(item as SkillInput).confidence} onChange={e => update(index,{confidence:Number(e.currentTarget.value)})}>{[1,2,3].map(x => <option value={x}>{x}</option>)}</select></label></>}
      {target === 'milestones' && <><label>Type<select value={(item as MilestoneInput).kind} onChange={e => update(index,{kind:e.currentTarget.value})}>{['exam','application','elective','reference','form','other'].map(x => <option value={x}>{x}</option>)}</select></label><label>Due date<input type="date" value={(item as MilestoneInput).dueDate} onInput={e => update(index,{dueDate:e.currentTarget.value})} /></label><label>Notes<textarea value={(item as MilestoneInput).notes} onInput={e => update(index,{notes:e.currentTarget.value})} /></label><label>Link<input type="url" value={(item as MilestoneInput).url} onInput={e => update(index,{url:e.currentTarget.value})} /></label><label>Checklist · one step per line<textarea value={(item as MilestoneInput).steps.map(s => s.title).join('\n')} onInput={e => update(index,{steps:e.currentTarget.value.split('\n').filter(Boolean).map(title => ({id:'',title,done:false}))})} /></label></>}
    </div><div class="workspace-card-actions"><button onClick={() => save(index)}>Save this entry</button><button onClick={() => setSuggestions(suggestions.filter((_,i) => i !== index))}>Dismiss</button></div></article>)}</div>}
  </section>
}
