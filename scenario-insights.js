const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const insightFingerprint = memory => JSON.stringify([memory.text, memory.context, memory.subject, memory.roomId, memory.understanding].map(value => String(value ?? '').normalize('NFKC').replace(/[\s，。；、！!?？,.；;：:]/gu, '')));

/** Incremental, scoped understandings; ordinary execution never enters this view. */
export function createScenarioInsights({ sheet, getMemories }) {
  const entries = new Map(), viewed = new Map();
  let observer = null, version = 0;
  const e = escapeHTML;
  function note({ key, memory, effect, source, kind = '照料偏好', semanticKey = null, refreshOnly = false }) {
    if (!memory || memory.visibility !== 'family' || !memory.enabled || memory.expired) return;
    const fingerprint = insightFingerprint(memory), previous = entries.get(memory.id);
    if (previous?.fingerprint === fingerprint) return;
    if (previous && semanticKey && previous.semanticKey === semanticKey) {
      Object.assign(previous, { fingerprint, text: memory.text, effect, source, kind }); return;
    }
    if (!previous && refreshOnly) return;
    entries.set(memory.id, { key, memoryId: memory.id, fingerprint, text: memory.text, effect, source, kind, semanticKey, version: ++version, read: false });
  }
  function forget(memoryId) { const item = entries.get(memoryId); if (item) item.read = true; }
  function markup(key) {
    const memories = getMemories() || [];
    const list = [...entries.values()].filter(item => {
      const memory = memories.find(value => value.id === item.memoryId);
      return item.key === key && !item.read && memory?.enabled && !memory.expired && memory.visibility === 'family' && insightFingerprint(memory) === item.fingerprint;
    }).sort((a, b) => b.version - a.version).slice(0, 3);
    if (!list.length) return '';
    return `<section class="hsc-insights" aria-label="小元的新理解"><h3>小元的新理解</h3>${list.map(item => `<details class="hsc-insight-card" data-insight-id="${e(item.memoryId)}" data-insight-version="${item.version}"><summary><div><small>${e(item.kind)}</small><strong>${e(item.text)}</strong><p>${e(item.effect)}</p></div><span class="hsc-insight-chevron" aria-hidden="true"></span></summary><div class="hsc-insight-source"><span>来自你的补充</span><p>${e(item.source)}</p></div></details>`).join('')}</section>`;
  }
  function observe() {
    observer?.disconnect();
    const root = sheet.querySelector('.sheet-body'), Observer = sheet.ownerDocument.defaultView.IntersectionObserver;
    if (!root || !Observer) return;
    observer = new Observer(changes => {
      for (const change of changes) if (change.isIntersecting && change.intersectionRatio >= .6) viewed.set(change.target.dataset.insightId, Number(change.target.dataset.insightVersion));
    }, { root, threshold: .6 });
    sheet.querySelectorAll('[data-insight-id]').forEach(card => observer.observe(card));
  }
  function finishReading() {
    for (const [id, revision] of viewed) { const item = entries.get(id); if (item?.version === revision) item.read = true; }
    viewed.clear(); observer?.disconnect();
  }
  return { note, forget, markup, observe, finishReading, destroy() { observer?.disconnect(); entries.clear(); viewed.clear(); } };
}
