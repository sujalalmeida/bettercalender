import { liveQuery } from 'dexie'
import { useState } from 'preact/hooks'
import { db } from '../db/db'
import type { Milestone, RevisionTopic, SkillEntry } from '../db/types'
import { deleteMilestone, deleteRevision, deleteSkill, nextReviewDate, reviewRevision, saveMilestone, saveRevision, saveSkill, setMilestoneStatus, setSkillStatus, toggleMilestoneStep, toggleRevisionMastered } from '../db/learningRepository'
import { todayISO, daysUntilLabel } from '../lib/dates'
import { useLazyComponent } from '../lib/useLazyComponent'
import { useObservable } from '../lib/useObservable'

type Kind = 'revision' | 'skills' | 'milestones'
type Props = { kind: Kind }
const kinds: Milestone['kind'][] = ['exam', 'application', 'elective', 'reference', 'form', 'other']
const emptyRevision = () => ({ title: '', subject: '', reason: '', takeaway: '', source: '', confidence: 2 as 1 | 2 | 3, nextReviewDate: nextReviewDate(2) })
const emptySkill = () => ({ kind: 'learning' as SkillEntry['kind'], title: '', note: '', rotation: '', nextStep: '', confidence: 2 as 1 | 2 | 3, status: 'active' as SkillEntry['status'] })
const emptyMilestone = () => ({ kind: 'exam' as Milestone['kind'], title: '', dueDate: '', notes: '', url: '', steps: [] as Milestone['steps'], status: 'planned' as Milestone['status'] })

export default function LearningScreen({ kind }: Props) {
  const [revision, setRevision] = useState(emptyRevision)
  const [skill, setSkill] = useState(emptySkill)
  const [milestone, setMilestone] = useState(emptyMilestone)
  const [stepsText, setStepsText] = useState('')
  const [editingId, setEditingId] = useState<string | undefined>()
  const [showForm, setShowForm] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [error, setError] = useState('')
  const revisions = useObservable(() => liveQuery(() => db.revisionTopics.toArray()), [], [] as RevisionTopic[])
  const skills = useObservable(() => liveQuery(() => db.skills.toArray()), [], [] as SkillEntry[])
  const milestones = useObservable(() => liveQuery(() => db.milestones.toArray()), [], [] as Milestone[])
  const AIImport = useLazyComponent(() => import('./AIImport'), showAI)

  function reset() { setRevision(emptyRevision()); setSkill(emptySkill()); setMilestone(emptyMilestone()); setStepsText(''); setEditingId(undefined); setShowForm(false); setError('') }
  function edit(item: RevisionTopic | SkillEntry | Milestone) {
    setEditingId(item.id); setShowForm(true); setShowAI(false); setError('')
    if (kind === 'revision') { const x = item as RevisionTopic; setRevision({ title: x.title, subject: x.subject, reason: x.reason, takeaway: x.takeaway, source: x.source, confidence: x.confidence, nextReviewDate: x.nextReviewDate }) }
    if (kind === 'skills') { const x = item as SkillEntry; setSkill({ kind: x.kind, title: x.title, note: x.note, rotation: x.rotation, nextStep: x.nextStep, confidence: x.confidence, status: x.status }) }
    if (kind === 'milestones') { const x = item as Milestone; setMilestone({ kind: x.kind, title: x.title, dueDate: x.dueDate, notes: x.notes, url: x.url, steps: x.steps, status: x.status }); setStepsText(x.steps.map(s => s.title).join('\n')) }
  }
  async function submit(event: Event) {
    event.preventDefault(); setError('')
    try {
      if (kind === 'revision') await saveRevision(revision, editingId)
      if (kind === 'skills') await saveSkill(skill, editingId)
      if (kind === 'milestones') {
        const names = stepsText.split('\n').map(x => x.trim()).filter(Boolean)
        const steps = names.map((title, index) => ({ id: milestone.steps[index]?.title === title ? milestone.steps[index].id : '', title, done: milestone.steps[index]?.title === title ? milestone.steps[index].done : false }))
        await saveMilestone({ ...milestone, steps }, editingId)
      }
      reset()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save this item.') }
  }
  async function remove(id: string) {
    if (!confirm('Delete this item?')) return
    try { if (kind === 'revision') await deleteRevision(id); if (kind === 'skills') await deleteSkill(id); if (kind === 'milestones') await deleteMilestone(id) }
    catch { setError('Could not delete this item.') }
  }
  const heading = kind === 'revision' ? 'Revision' : kind === 'skills' ? 'Skills & learning' : 'Milestones'
  const description = kind === 'revision' ? 'Keep track of weak topics and what to revisit next.' : kind === 'skills' ? 'Capture what you learned or practised, without patient details.' : 'Keep exams, applications and follow-ups in one place.'
  const activeRevisions = revisions.filter(x => !x.mastered).sort((a,b) => a.nextReviewDate.localeCompare(b.nextReviewDate))
  const sortedSkills = [...skills].sort((a,b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1) || b.updatedAt-a.updatedAt)
  const sortedMilestones = [...milestones].sort((a,b) => (a.status === 'done' || a.status === 'cancelled' ? 1 : 0) - (b.status === 'done' || b.status === 'cancelled' ? 1 : 0) || (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))

  return <section class="workspace-screen">
    <header class="workspace-header"><div><span class="workspace-eyebrow">FINAL YEAR</span><h1>{heading}</h1><p>{description}</p></div><div class="workspace-actions"><button class="workspace-secondary" onClick={() => { reset(); setShowAI(!showAI) }}>✦ Suggest with Gemini</button><button class="workspace-primary" onClick={() => { reset(); setShowAI(false); setShowForm(true) }}>+ Add {kind === 'revision' ? 'topic' : kind === 'skills' ? 'entry' : 'milestone'}</button></div></header>
    {error && <p class="workspace-error" role="alert">{error}</p>}
    {showAI && AIImport && <AIImport target={kind} onClose={() => setShowAI(false)} />}
    {showForm && <form class="workspace-form" onSubmit={submit}>
      <div class="workspace-form-head"><h2>{editingId ? 'Edit' : 'New'} {kind === 'revision' ? 'topic' : kind === 'skills' ? 'entry' : 'milestone'}</h2><button type="button" onClick={reset} aria-label="Close form">✕</button></div>
      {kind === 'revision' && <div class="workspace-fields">
        <label>Topic or question<input required value={revision.title} onInput={e => setRevision({ ...revision, title: e.currentTarget.value })} placeholder="e.g. Causes of hyponatraemia" /></label>
        <label>Subject / rotation<input value={revision.subject} onInput={e => setRevision({ ...revision, subject: e.currentTarget.value })} placeholder="e.g. Medicine" /></label>
        <label>Question source<input value={revision.source} onInput={e => setRevision({ ...revision, source: e.currentTarget.value })} placeholder="Question bank or lecture" /></label>
        <label>Why did I miss it?<textarea value={revision.reason} onInput={e => setRevision({ ...revision, reason: e.currentTarget.value })} /></label>
        <label>One takeaway<textarea value={revision.takeaway} onInput={e => setRevision({ ...revision, takeaway: e.currentTarget.value })} /></label>
        <label>Confidence<select value={revision.confidence} onChange={e => setRevision({ ...revision, confidence: Number(e.currentTarget.value) as 1|2|3 })}><option value="1">1 · Need another look</option><option value="2">2 · Getting there</option><option value="3">3 · Comfortable</option></select></label>
        <label>Review on<input type="date" required value={revision.nextReviewDate} onInput={e => setRevision({ ...revision, nextReviewDate: e.currentTarget.value })} /></label>
      </div>}
      {kind === 'skills' && <div class="workspace-fields">
        <label>Entry type<select value={skill.kind} onChange={e => setSkill({ ...skill, kind: e.currentTarget.value as SkillEntry['kind'] })}><option value="learning">Something I learned</option><option value="practice">Skill I practised</option></select></label>
        <label>Title<input required value={skill.title} onInput={e => setSkill({ ...skill, title: e.currentTarget.value })} placeholder="e.g. ECG interpretation" /></label>
        <label>Rotation / placement<input value={skill.rotation} onInput={e => setSkill({ ...skill, rotation: e.currentTarget.value })} /></label>
        <label>Brief note<textarea value={skill.note} onInput={e => setSkill({ ...skill, note: e.currentTarget.value })} placeholder="Keep patient details out" /></label>
        <label>Next step<input value={skill.nextStep} onInput={e => setSkill({ ...skill, nextStep: e.currentTarget.value })} placeholder="e.g. Practise again this week" /></label>
        <label>Confidence<select value={skill.confidence} onChange={e => setSkill({ ...skill, confidence: Number(e.currentTarget.value) as 1|2|3 })}><option value="1">1 · Need practice</option><option value="2">2 · Developing</option><option value="3">3 · Comfortable</option></select></label>
        <label>Status<select value={skill.status} onChange={e => setSkill({ ...skill, status: e.currentTarget.value as SkillEntry['status'] })}><option value="active">Active</option><option value="done">Done</option><option value="cancelled">Cancelled</option></select></label>
      </div>}
      {kind === 'milestones' && <div class="workspace-fields">
        <label>Type<select value={milestone.kind} onChange={e => setMilestone({ ...milestone, kind: e.currentTarget.value as Milestone['kind'] })}>{kinds.map(x => <option value={x}>{x[0].toUpperCase()+x.slice(1)}</option>)}</select></label>
        <label>Title<input required value={milestone.title} onInput={e => setMilestone({ ...milestone, title: e.currentTarget.value })} placeholder="e.g. Submit elective application" /></label>
        <label>Due date<input type="date" value={milestone.dueDate} onInput={e => setMilestone({ ...milestone, dueDate: e.currentTarget.value })} /></label>
        <label>Notes<textarea value={milestone.notes} onInput={e => setMilestone({ ...milestone, notes: e.currentTarget.value })} /></label>
        <label>Link<input type="url" value={milestone.url} onInput={e => setMilestone({ ...milestone, url: e.currentTarget.value })} placeholder="https://" /></label>
        <label>Checklist · one step per line<textarea value={stepsText} onInput={e => setStepsText(e.currentTarget.value)} placeholder="Request reference&#10;Upload transcript" /></label>
        <label>Status<select value={milestone.status} onChange={e => setMilestone({ ...milestone, status: e.currentTarget.value as Milestone['status'] })}><option value="planned">Planned</option><option value="waiting">Waiting</option><option value="done">Done</option><option value="cancelled">Cancelled</option></select></label>
      </div>}
      <div class="workspace-form-actions"><button type="button" class="workspace-secondary" onClick={reset}>Cancel</button><button type="submit" class="workspace-primary">Save</button></div>
    </form>}
    {kind === 'revision' && <div class="workspace-list"><h2>Review queue <span>{activeRevisions.filter(x => x.nextReviewDate <= todayISO()).length} due</span></h2>{activeRevisions.length === 0 && <div class="workspace-empty">No weak topics yet. Add one when a question catches you out.</div>}{activeRevisions.map(x => <article class="workspace-card" key={x.id}><div class="workspace-card-top"><span class="workspace-pill">{x.subject || 'Revision'}</span><span class={x.nextReviewDate <= todayISO() ? 'workspace-due' : 'workspace-muted'}>{x.nextReviewDate <= todayISO() ? 'Review ' : 'Next review '}{x.nextReviewDate}</span></div><h3>{x.title}</h3>{x.reason && <p><strong>Missed:</strong> {x.reason}</p>}{x.takeaway && <p><strong>Takeaway:</strong> {x.takeaway}</p>}{x.source && <p class="workspace-muted">Source: {x.source}</p>}<div class="workspace-card-actions"><button onClick={() => edit(x)}>Edit</button><button onClick={() => toggleRevisionMastered(x)}>Mastered</button>{x.nextReviewDate <= todayISO() && [1,2,3].map(c => <button onClick={() => reviewRevision(x,c as 1|2|3)}>{c === 1 ? 'Again · 1d' : c === 2 ? 'Soon · 3d' : 'Comfortable · 7d'}</button>)}<button onClick={() => remove(x.id)}>Delete</button></div></article>)}{revisions.some(x => x.mastered) && <details class="workspace-archive"><summary>Mastered topics ({revisions.filter(x => x.mastered).length})</summary>{revisions.filter(x => x.mastered).map(x => <article class="workspace-card" key={x.id}><h3>{x.title}</h3><div class="workspace-card-actions"><button onClick={() => toggleRevisionMastered(x)}>Return to queue</button><button onClick={() => edit(x)}>Edit</button><button onClick={() => remove(x.id)}>Delete</button></div></article>)}</details>}</div>}
    {kind === 'skills' && <div class="workspace-list"><h2>Learning log <span>{skills.length} entries</span></h2>{skills.length === 0 && <div class="workspace-empty">A quick note is enough. Record what you learned or practised.</div>}{sortedSkills.map(x => <article class="workspace-card" key={x.id}><div class="workspace-card-top"><span class="workspace-pill">{x.kind === 'learning' ? 'Learned' : 'Practised'}{x.rotation ? ` · ${x.rotation}` : ''}</span><span class="workspace-muted">{x.status}</span></div><h3>{x.title}</h3>{x.note && <p>{x.note}</p>}{x.nextStep && <p><strong>Next:</strong> {x.nextStep}</p>}<div class="workspace-card-actions"><button onClick={() => edit(x)}>Edit</button>{x.status !== 'done' && <button onClick={() => setSkillStatus(x.id,'done')}>Done</button>}{x.status !== 'cancelled' && <button onClick={() => setSkillStatus(x.id,'cancelled')}>Cancel</button>}{x.status !== 'active' && <button onClick={() => setSkillStatus(x.id,'active')}>Reopen</button>}<button onClick={() => remove(x.id)}>Delete</button></div></article>)}</div>}
    {kind === 'milestones' && <div class="workspace-list"><h2>What’s ahead <span>{milestones.filter(x => x.status !== 'done' && x.status !== 'cancelled').length} open</span></h2>{milestones.length === 0 && <div class="workspace-empty">Add an exam, elective, application or other important date.</div>}{sortedMilestones.map(x => <article class="workspace-card" key={x.id}><div class="workspace-card-top"><span class="workspace-pill">{x.kind}</span><span class={x.dueDate && x.dueDate < todayISO() && x.status !== 'done' ? 'workspace-due' : 'workspace-muted'}>{x.dueDate ? `${x.dueDate} · ${daysUntilLabel(x.dueDate)}` : x.status}</span></div><h3>{x.title}</h3>{x.notes && <p>{x.notes}</p>}{x.url && <a href={x.url} target="_blank" rel="noopener noreferrer">Open link ↗</a>}{x.steps.length > 0 && <div class="workspace-steps">{x.steps.map(s => <label key={s.id}><input type="checkbox" checked={s.done} onChange={() => toggleMilestoneStep(x,s.id)} />{s.title}</label>)}</div>}<div class="workspace-card-actions"><button onClick={() => edit(x)}>Edit</button>{x.status !== 'done' && <button onClick={() => setMilestoneStatus(x.id,'done')}>Done</button>}{x.status !== 'cancelled' && <button onClick={() => setMilestoneStatus(x.id,'cancelled')}>Cancel</button>}{x.status !== 'planned' && <button onClick={() => setMilestoneStatus(x.id,'planned')}>Reopen</button>}<button onClick={() => remove(x.id)}>Delete</button></div></article>)}</div>}
  </section>
}
