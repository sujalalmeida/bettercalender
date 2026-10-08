import { render } from 'preact'
import { App } from './App'
import { ensureSeedData } from './db/db'
import { db } from './db/db'
import { createId } from './lib/id'
import { initPWAUpdate } from './lib/pwaUpdate'
import './styles/global.css'
import './styles/app.css'

initPWAUpdate()

const root = document.getElementById('app')!

async function start() {
  try {
    await db.open()
    const hadDatabase = localStorage.getItem('plan.installation-id')
    const installation = await db.settings.get('installationId')
    const dataMissing = Boolean(hadDatabase && !installation)
    if (!installation) {
      const id = createId()
      await db.settings.put({ key: 'installationId', value: id })
      localStorage.setItem('plan.installation-id', id)
    } else {
      localStorage.setItem('plan.installation-id', String(installation.value))
    }
    await ensureSeedData()
    let storageDenied = false
    if (navigator.storage?.persist) {
      const persisted = await navigator.storage.persisted()
      if (!persisted) storageDenied = !(await navigator.storage.persist())
    }
    render(<App initialStorageNotice={dataMissing ? 'Your saved data may have been cleared by this device. Import your latest backup in Settings to restore it.' : storageDenied && !localStorage.getItem('plan.storage-explained') ? 'This device could not guarantee permanent storage. Please export a backup regularly in Settings.' : null} />, root)
    if (storageDenied) localStorage.setItem('plan.storage-explained', '1')
  } catch (error) {
    console.error('Could not open Plan', error)
    render(<div class="startup-error"><h1>Plan could not open</h1><p>Your device storage is temporarily unavailable. Try closing and reopening the app.</p><button onClick={() => location.reload()}>Try again</button></div>, root)
  }
}

void start()
