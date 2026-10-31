/** Preserve locally installed optional stores during a calendar-only schema upgrade. */
export function existingExtraStores(name:string,known:Set<string>):Promise<Record<string,string>> {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(name)
    let newlyCreated=false
    request.onupgradeneeded=()=>{newlyCreated=true;request.transaction?.abort()}
    request.onerror=()=>{if(newlyCreated)resolve({});else reject(request.error)}
    request.onsuccess=()=>{
      const database=request.result
      try {
        const names=Array.from(database.objectStoreNames).filter(n=>!known.has(n))
        if(!names.length){database.close();resolve({});return}
        const transaction=database.transaction(names,'readonly')
        const key=(value:string|string[]|null)=>Array.isArray(value)?`[${value.join('+')}]`:value??''
        const stores:Record<string,string>={}
        for(const storeName of names){
          const store=transaction.objectStore(storeName)
          const primary=(store.autoIncrement?'++':'')+key(store.keyPath)
          const indexes=Array.from(store.indexNames).map(name=>{const index=store.index(name);return `${index.unique?'&':''}${index.multiEntry?'*':''}${key(index.keyPath)}`})
          stores[storeName]=[primary,...indexes].join(',')
        }
        database.close();resolve(stores)
      }catch(error){database.close();reject(error)}
    }
  })
}
