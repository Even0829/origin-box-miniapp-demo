const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const dateTimeFormat = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' });
const formatTime = (value) => { const date = new Date(typeof value === 'number' ? value : value || NaN); return Number.isFinite(date.getTime()) ? dateTimeFormat.format(date) : ''; };

function memoryIcon(name) {
  const paths = {
    back: '<path d="m14.5 5-7 7 7 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.4 15.4 4.6 4.6"/>',
    filter: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="10" cy="18" r="2" fill="currentColor" stroke="none"/>',
    close: '<path d="m7 7 10 10M17 7 7 17"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    memory: '<path d="M5 4h11a3 3 0 0 1 3 3v14H8a3 3 0 0 1-3-3V4ZM5 16h14M9 8h6M9 11h4"/>',
  };
  return `<svg class="mm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.memory}</svg>`;
}

// 用户记忆用于查看与修正当前理解；修改不改写既往经历，也不触发设备或会话操作。
export function createMemoryPage({ page, detailPage, store, getRooms, setView, openSheet, toast, icon, onConverse }) {
  const document = page.ownerDocument;
  const sheet = document.querySelector('#sheet');
  const e = escapeHTML;
  const query = (selector) => page.querySelector(selector);
  const detailQuery = (selector) => detailPage.querySelector(selector);
  const modalQuery = (selector) => sheet?.querySelector(selector);
  const closeSheet = () => sheet?.close();
  let currentView = '';
  let disposed = false;
  let search = '';
  let type = 'all';
  let filter = { scope: 'all', state: 'current' };
  let detailId = null;
  let lastCardId = null;
  let listScroll = 0;
  let lastListSignature = '';
  let lastDetailSignature = '';
  let detailBase = null, detailDraft = null, lastShortExpiry = '', saving = false;

  page.classList.add('mm-page');
  page.setAttribute('aria-labelledby', 'mm-title');
  page.innerHTML = `<header class="mm-header"><div><h1 id="mm-title">记忆</h1><p class="mm-subtitle">你告诉我的，和我逐渐了解的</p></div><button class="mm-add icon-button" data-mm-action="add" aria-label="添加记忆">${memoryIcon('plus')}</button></header><div class="mm-search">${memoryIcon('search')}<input id="mm-search" type="search" placeholder="搜索记忆" aria-label="搜索记忆" autocomplete="off" spellcheck="false"><button class="mm-search-clear" data-mm-action="clear-search" aria-label="清空搜索" hidden>${memoryIcon('close')}</button></div><div class="mm-toolbar"><div class="mm-tabs" role="tablist" aria-label="记忆适用时效">${[['all', '全部'], ['short', '短期'], ['long', '长期']].map(([value, label]) => `<button class="mm-tab${value === 'all' ? ' is-selected' : ''}" id="mm-tab-${value}" role="tab" aria-controls="mm-list-panel" aria-selected="${value === 'all'}" tabindex="${value === 'all' ? 0 : -1}" data-mm-tab="${value}">${label}</button>`).join('')}</div><button class="mm-filter-button" data-mm-action="filter" aria-label="筛选记忆">${memoryIcon('filter')}<span class="mm-filter-dot" hidden></span></button></div><p class="mm-summary" role="status" aria-live="polite"></p><main class="mm-scroll" id="mm-list-panel" role="tabpanel" aria-labelledby="mm-tab-all"><div class="mm-list"></div></main>`;

  detailPage.classList.add('mm-detail-page');
  detailPage.setAttribute('aria-labelledby', 'mm-detail-title');
  detailPage.innerHTML = `<header class="mm-detail-header"><button class="mm-back icon-button" data-mm-action="back" aria-label="返回记忆列表">${memoryIcon('back')}</button><h1 id="mm-detail-title">记忆详情</h1><span class="mm-header-spacer" aria-hidden="true"></span></header><main class="mm-detail-scroll"></main><footer class="mm-detail-footer"></footer><div class="mm-home-indicator" aria-hidden="true"></div>`;

  const normalize = (value) => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase('zh-CN');
  const scopeName = () => ({ all: '个人与家庭', personal: '仅个人', family: '家庭共享' }[filter.scope]);
  const stateName = () => ({ current: '当前可用', all: '全部状态', disabled: '已停用', expired: '已到期' }[filter.state]);
  const hasFilter = () => filter.scope !== 'all' || filter.state !== 'current';
  const rooms = () => getRooms?.() || [];

  function statusBadges(item) {
    const badges = [];
    if (!item.enabled) badges.push(['disabled', '已停用']);
    if (item.expired) badges.push(['expired', '已到期']);
    if (item.understanding === 'checking') badges.push(['checking', '待核对']);
    if (item.understanding === 'update') badges.push(['update', '待更新']);
    return badges.map(([status, text]) => `<span class="mm-badge" data-status="${status}">${text}</span>`).join('');
  }

  function filteredItems() {
    const needle = normalize(search);
    return store.getMemories().filter((item) => {
      if (type !== 'all' && item.type !== type) return false;
      if (filter.scope !== 'all' && item.visibility !== filter.scope) return false;
      if (filter.state === 'current' && (!item.enabled || item.expired)) return false;
      if (filter.state === 'disabled' && item.enabled) return false;
      if (filter.state === 'expired' && !item.expired) return false;
      return !needle || normalize([item.text, item.scopeText, item.subject, item.context, item.roomName, item.sourceLabel].filter(Boolean).join(' ')).includes(needle);
    });
  }

  function cardMarkup(item) {
    const scope = [item.visibility === 'family' ? '家庭共享' : '仅自己', item.roomName, item.context].filter(Boolean).join(' · ');
    return `<button class="mm-card" data-memory-id="${e(item.id)}" aria-label="查看记忆：${e(item.text)}"><p class="mm-conclusion">${e(item.text)}</p><p class="mm-scope">${e(scope)}</p><div class="mm-card-bottom"><span class="mm-source">${item.type === 'short' ? '短期' : '长期'} · ${e(item.sourceLabel || '你告诉我的')}</span><span class="mm-card-status">${statusBadges(item)}</span></div>${item.type === 'short' ? `<p class="mm-card-period">${e(item.periodText)}</p>` : ''}</button>`;
  }

  function emptyMarkup() {
    const filtered = type !== 'all' || hasFilter();
    const heading = search.trim() ? '没有找到相关记忆' : filtered ? '当前范围内还没有记忆' : '还没有记忆';
    const description = search.trim() ? '试试其他关键词，或清空搜索看看' : filtered ? '可以调整分类或筛选范围' : '可以添加希望小元记住的事';
    const action = search.trim() ? '<button class="secondary-button" data-mm-action="clear-search">清空搜索</button>' : filtered ? '<button class="secondary-button" data-mm-action="reset-filters">重置筛选</button>' : '<button class="primary-button" data-mm-action="add">添加记忆</button>';
    return `<section class="mm-empty">${memoryIcon('memory')}<h2>${heading}</h2><p>${description}</p>${action}</section>`;
  }

  function renderMain(force = false, resetScroll = false) {
    if (disposed) return;
    const items = filteredItems();
    const signature = JSON.stringify({ items, type, filter, search });
    if (!force && lastListSignature === signature) return;
    const scroll = query('.mm-scroll');
    const top = resetScroll ? 0 : currentView === 'memory' && page.getClientRects().length ? scroll.scrollTop : listScroll;
    const focused = document.activeElement;
    const focusedId = page.contains(focused) ? focused.dataset.memoryId : null;
    query('.mm-list').innerHTML = items.length ? items.map(cardMarkup).join('') : emptyMarkup();
    query('.mm-summary').textContent = `${items.length} 条 · ${scopeName()} · ${stateName()}`;
    query('.mm-search-clear').hidden = !search;
    query('.mm-filter-button').classList.toggle('is-active', hasFilter());
    query('.mm-filter-button').setAttribute('aria-label', hasFilter() ? `筛选记忆，${scopeName()}，${stateName()}` : '筛选记忆');
    query('.mm-filter-dot').hidden = !hasFilter();
    page.querySelectorAll('[data-mm-tab]').forEach((button) => { const selected = button.dataset.mmTab === type; button.classList.toggle('is-selected', selected); button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1; });
    scroll.setAttribute('aria-labelledby', `mm-tab-${type}`);
    scroll.scrollTop = top;
    listScroll = top;
    if (focusedId && currentView === 'memory') focusCard(focusedId);
    lastListSignature = signature;
  }

  function focusCard(id) {
    const card = [...page.querySelectorAll('[data-memory-id]')].find((element) => element.dataset.memoryId === id);
    (card || query('.mm-add'))?.focus({ preventScroll: true });
  }

  function fact(label, text) { return `<div><dt>${e(label)}</dt><dd>${e(text || '未限定')}</dd></div>`; }
  function evidenceMarkup(item) {
    if (!item.evidence?.length) return '';
    return `<details class="mm-disclosure" data-mm-section="evidence"><summary><span>形成依据</span>${memoryIcon('down')}</summary><div class="mm-evidence-list">${item.evidence.map((entry) => `<article class="mm-evidence"><strong>${e(entry.title || '形成依据')}</strong>${entry.text ? `<p>${e(entry.text)}</p>` : ''}${formatTime(entry.at) ? `<time>${e(formatTime(entry.at))}</time>` : ''}</article>`).join('')}</div></details>`;
  }
  function revisionsMarkup(item) {
    if (!item.previous?.length) return '';
    return `<details class="mm-disclosure" data-mm-section="revisions"><summary><span>最近修正</span>${memoryIcon('down')}</summary><div class="mm-revision-list">${item.previous.map((entry) => `<article class="mm-revision"><strong>${e(entry.text)}</strong>${entry.scopeText ? `<p>${e(entry.scopeText)}</p>` : ''}${formatTime(entry.at) ? `<time>${e(formatTime(entry.at))}</time>` : ''}</article>`).join('')}</div></details>`;
  }

  function draftFrom(item) {
    return { text: item.text, type: item.type, roomId: item.roomId, context: item.context || '', expiresAt: item.expiresAt, enabled: item.enabled, confirmUnderstanding: false };
  }
  function normalizedDraft(draft) {
    return { text: draft.text.trim(), type: draft.type, roomId: draft.roomId || null, context: draft.context.trim(), expiresAt: draft.type === 'long' ? null : draft.expiresAt || '', enabled: draft.enabled, confirmUnderstanding: Boolean(draft.confirmUnderstanding) };
  }
  function detailDirty() { return Boolean(detailBase && detailDraft && JSON.stringify(normalizedDraft(detailDraft)) !== JSON.stringify(normalizedDraft(draftFrom(detailBase)))); }
  function updateSaveButton() {
    const button = detailQuery('.mm-save-button');
    if (button) button.disabled = saving || !detailDirty();
  }
  function draftItem() {
    const value = normalizedDraft(detailDraft);
    return { ...detailBase, ...value, understanding: value.confirmUnderstanding ? 'clear' : detailBase.understanding, expired: value.type === 'short' && Boolean(value.expiresAt) && value.expiresAt < store.today() };
  }
  function applyVoiceDraft(plan) {
    if (!detailDraft || !detailBase || plan.next?.id !== detailBase.id) return false;
    for (const field of ['text', 'type', 'roomId', 'context', 'expiresAt', 'confirmUnderstanding']) if (field in plan.patch) detailDraft[field] = plan.patch[field];
    if (plan.enabled !== undefined) detailDraft.enabled = plan.enabled;
    if (detailDraft.type === 'short') lastShortExpiry = detailDraft.expiresAt || '';
    renderDetail(true);
    if (currentView === 'memory-detail') requestAnimationFrame(() => detailQuery('.mm-save-button')?.focus({ preventScroll: true }));
    return draftItem();
  }
  function renderDetail(force = false) {
    if (disposed || !detailId || saving) return;
    const current = store.get(detailId);
    if (!current) { if (currentView === 'memory-detail') { toast('这条记忆已不可用'); returnToList(); } return; }
    const signature = JSON.stringify(current);
    if (!force && signature === lastDetailSignature) return;
    if (!detailBase || !detailDraft || (!detailDirty() && signature !== JSON.stringify(detailBase))) {
      detailBase = current; detailDraft = draftFrom(current); lastShortExpiry = current.expiresAt || '';
    }
    const item = detailBase, value = detailDraft;
    const scroll = detailQuery('.mm-detail-scroll'), top = scroll.scrollTop;
    const openSections = [...scroll.querySelectorAll('details[open]')].map((element) => element.dataset.mmSection);
    const roomOptions = [{ id: '', name: '不限定空间' }, ...rooms()];
    if (value.roomId && !roomOptions.some((room) => room.id === value.roomId)) roomOptions.push({ id: value.roomId, name: '原空间已移除' });
    scroll.innerHTML = `<form class="mm-form mm-detail-editor" id="mm-detail-form" novalidate>
      <div class="mm-edit-status">${statusBadges(item)}${item.understanding === 'clear' ? '<span class="mm-badge" data-status="clear">已明确</span>' : ''}</div>
      <div class="mm-field"><label for="mm-detail-text">记住的事</label><textarea class="mm-textarea" id="mm-detail-text" name="text" maxlength="80" rows="3">${e(value.text)}</textarea></div>
      <div class="mm-edit-scope"><span>所属范围</span><strong>${item.visibility === 'family' ? '家庭共享' : '仅自己'}</strong></div>
      <div class="mm-edit-row"><div class="mm-field"><label for="mm-detail-type">适用时效</label><select id="mm-detail-type" name="type"><option value="short" ${value.type === 'short' ? 'selected' : ''}>短期</option><option value="long" ${value.type === 'long' ? 'selected' : ''}>长期</option></select></div><div class="mm-field"><label for="mm-detail-room">适用空间</label><select id="mm-detail-room" name="roomId">${roomOptions.map((room) => `<option value="${e(room.id)}" ${(value.roomId || '') === room.id ? 'selected' : ''}>${e(room.name)}</option>`).join('')}</select></div></div>
      <div class="mm-field" id="mm-detail-date-field" ${value.type === 'long' ? 'hidden' : ''}><label for="mm-detail-expiry">适用至</label><input id="mm-detail-expiry" type="date" name="expiresAt" min="${e(store.today())}" value="${e(value.expiresAt || '')}"><p class="mm-field-hint">截止日期当天仍适用</p></div>
      <div class="mm-field"><label for="mm-detail-context">适用情境<span class="mm-optional">可选</span></label><input id="mm-detail-context" name="context" maxlength="40" value="${e(value.context)}" placeholder="例如：阅读、晚间休息"></div>
      <div class="mm-edit-use"><label><input id="mm-detail-enabled" type="checkbox" role="switch" name="enabled" aria-label="使用这条记忆" aria-describedby="mm-use-hint" ${value.enabled ? 'checked' : ''}><span>使用这条记忆</span><small id="mm-use-hint">停用后保留记录，不再作为帮助依据</small></label></div>
      ${item.understanding !== 'clear' ? `<div class="mm-edit-confirm"><label><input type="checkbox" name="confirmUnderstanding" ${value.confirmUnderstanding ? 'checked' : ''}><span>确认当前理解</span></label></div>` : ''}
      <p class="mm-save-feedback" role="alert"></p>
    </form>
    <details class="mm-disclosure" data-mm-section="source"><summary><span>来源与用途</span>${memoryIcon('down')}</summary><section class="mm-detail-section"><p class="mm-detail-source">${e(item.sourceLabel || '你告诉我的')}</p>${item.sourceDetail ? `<p>${e(item.sourceDetail)}</p>` : ''}<p>适用对象：${e(item.subject)}</p>${item.help ? `<p>${e(item.help)}</p>` : ''}${formatTime(item.updatedAt) ? `<p>更新于 ${e(formatTime(item.updatedAt))}</p>` : ''}</section></details>${evidenceMarkup(item)}${revisionsMarkup(item)}`;
    for (const key of openSections) scroll.querySelector(`details[data-mm-section="${key}"]`)?.setAttribute('open', '');
    detailQuery('.mm-detail-footer').innerHTML = `<button class="mm-ai-entry" data-mm-action="tell-memory" aria-label="告诉小元纠正这条记忆"><span>告诉小元，帮我纠正这条记忆</span><span class="mm-ai-voice"><img src="assets/voice.svg" alt=""></span></button><button class="mm-save-button primary-button" data-mm-action="save" type="submit" form="mm-detail-form" ${!detailDirty() ? 'disabled' : ''}>保存</button>`;
    detailQuery('#mm-detail-form').onsubmit = (event) => { event.preventDefault(); saveDetail(); };
    scroll.scrollTop = top;
    lastDetailSignature = signature;
  }
  function detailInput(event) {
    const input = event.target;
    if (!detailDraft || input.form?.id !== 'mm-detail-form' || !input.name) return;
    if (input.name === 'enabled' || input.name === 'confirmUnderstanding') detailDraft[input.name] = input.checked;
    else if (input.name === 'roomId') detailDraft.roomId = input.value || null;
    else if (input.name === 'type') {
      if (detailDraft.type === 'short') lastShortExpiry = detailDraft.expiresAt || '';
      detailDraft.type = input.value;
      detailDraft.expiresAt = input.value === 'short' ? lastShortExpiry : null;
      detailQuery('#mm-detail-date-field').hidden = input.value === 'long';
      detailQuery('#mm-detail-expiry').value = detailDraft.expiresAt || '';
    } else { detailDraft[input.name] = input.value; if (input.name === 'expiresAt') lastShortExpiry = input.value; }
    detailQuery('.mm-save-feedback').textContent = '';
    input.removeAttribute('aria-invalid');
    updateSaveButton();
  }
  function detailError(field, message) {
    detailQuery('.mm-save-feedback').textContent = message;
    const input = field ? detailQuery(`[name="${field}"]`) : null;
    input?.setAttribute('aria-invalid', 'true'); input?.focus();
  }
  function saveDetail() {
    if (!detailDirty() || saving) return !detailDirty();
    const current = store.get(detailId);
    if (JSON.stringify(current) !== JSON.stringify(detailBase)) { detailError(null, '这条记忆已有新变化，请返回后重新打开再调整'); return false; }
    const value = normalizedDraft(detailDraft);
    if (value.enabled && value.type === 'short' && (!value.expiresAt || value.expiresAt < store.today())) { detailError('expiresAt', '请先设置今天或之后的适用日期'); return false; }
    const patch = {};
    for (const key of ['text', 'type', 'roomId', 'context', 'expiresAt']) if (value[key] !== detailBase[key]) patch[key] = value[key];
    if (value.confirmUnderstanding) patch.confirmUnderstanding = true;
    saving = true; updateSaveButton();
    let result = { ok: true, item: current };
    if (Object.keys(patch).length) result = store.update(detailId, patch);
    if (result.ok && value.enabled !== result.item.enabled) result = store.setEnabled(detailId, value.enabled);
    saving = false;
    if (!result.ok) { detailError(result.field, result.error || '暂时无法保存，请重试'); updateSaveButton(); return false; }
    detailBase = store.get(detailId); detailDraft = draftFrom(detailBase); lastDetailSignature = '';
    renderMain(true); renderDetail(true); toast('已保存');
    return true;
  }

  function openDetail(id) {
    if (!store.get(id)) { toast('这条记忆已不可用'); return; }
    listScroll = query('.mm-scroll').scrollTop;
    lastCardId = id;
    detailId = id;
    detailBase = store.get(id); detailDraft = draftFrom(detailBase); lastShortExpiry = detailBase.expiresAt || '';
    lastDetailSignature = '';
    currentView = 'memory-detail';
    renderDetail(true);
    detailQuery('.mm-detail-scroll').scrollTop = 0;
    setView('memory-detail');
    detailQuery('.mm-back').focus({ preventScroll: true });
  }

  function showFilters() {
    let draft = { ...filter };
    const choices = (name, options, selected) => `<div class="mm-filter-options">${options.map(([value, label]) => `<label><input type="radio" name="mm-filter-${name}" value="${value}" ${value === selected ? 'checked' : ''}><span>${label}</span><i aria-hidden="true">${memoryIcon('check')}</i></label>`).join('')}</div>`;
    openSheet('筛选记忆', `<div class="mm-filter-intro"><span>按所属范围和使用状态查看</span><button class="mm-text-button" id="mm-filter-reset">重置</button></div><fieldset class="mm-filter-group"><legend>所属范围</legend>${choices('scope', [['all', '个人与家庭'], ['personal', '仅个人'], ['family', '家庭共享']], draft.scope)}</fieldset><fieldset class="mm-filter-group"><legend>使用状态</legend>${choices('state', [['current', '当前可用'], ['all', '全部状态'], ['disabled', '已停用'], ['expired', '已到期']], draft.state)}</fieldset><div class="dialog-actions"><button class="secondary-button" id="mm-filter-cancel">取消</button><button class="primary-button" id="mm-filter-apply">应用筛选</button></div>`, { restoreFocus: () => { if (currentView === 'memory') query('.mm-filter-button').focus({ preventScroll: true }); } });
    sheet.dataset.content = 'memory-filter';
    sheet.querySelectorAll('[name^="mm-filter-"]').forEach((input) => { input.onchange = () => { draft[input.name.endsWith('scope') ? 'scope' : 'state'] = input.value; }; });
    modalQuery('#mm-filter-reset').onclick = () => { draft = { scope: 'all', state: 'current' }; sheet.querySelectorAll('[name^="mm-filter-"]').forEach((input) => { input.checked = input.value === draft[input.name.endsWith('scope') ? 'scope' : 'state']; }); };
    modalQuery('#mm-filter-cancel').onclick = closeSheet;
    modalQuery('#mm-filter-apply').onclick = () => { filter = draft; renderMain(true, true); closeSheet(); };
  }

  function showEditor(id = null, initialField = null) {
    const item = id ? store.get(id) : null;
    if (id && !item) { toast('这条记忆已不可用'); return; }
    const editing = Boolean(item), selectedType = item?.type || 'long';
    const confirming = editing && initialField !== 'expiresAt' && item.understanding !== 'clear';
    const label = editing ? (initialField === 'expiresAt' ? '调整适用时间' : confirming ? '核对理解' : '纠正理解') : '添加记忆';
    const roomOptions = [{ id: '', name: '不限定空间' }, ...rooms()];
    if (item?.roomId && !roomOptions.some((room) => room.id === item.roomId)) roomOptions.push({ id: item.roomId, name: '原空间已移除' });
    const fieldError = (field) => `<p class="mm-field-error" id="mm-error-${field}" role="alert"></p>`;
    openSheet(label, `<form class="mm-form" id="mm-editor" novalidate><div class="mm-field"><label for="mm-memory-text">要记住的事</label><textarea class="mm-textarea" id="mm-memory-text" name="text" rows="3" maxlength="80" placeholder="例如：阅读时偏好柔和的灯光" aria-describedby="mm-error-text">${e(item?.text || '')}</textarea>${fieldError('text')}<p class="mm-field-hint">简洁描述一件事，最多80字</p></div>${editing ? `<div class="mm-readonly-field"><span>所属范围</span><strong>${item.visibility === 'family' ? '家庭共享' : '仅自己'}</strong></div>` : `<fieldset class="mm-visibility"><legend>所属范围</legend><label><input type="radio" name="visibility" value="personal" checked><span>仅自己</span></label><label><input type="radio" name="visibility" value="family"><span>家庭共享</span></label><p class="mm-field-hint">家庭共享内容会作为家庭共同安排的参考</p>${fieldError('visibility')}</fieldset>`}<div class="mm-form-row"><div class="mm-field"><label for="mm-memory-type">适用时效</label><select class="mm-select" id="mm-memory-type" name="type"><option value="short" ${selectedType === 'short' ? 'selected' : ''}>短期</option><option value="long" ${selectedType === 'long' ? 'selected' : ''}>长期</option></select>${fieldError('type')}</div><div class="mm-field"><label for="mm-memory-room">适用空间</label><select class="mm-select" id="mm-memory-room" name="roomId">${roomOptions.map((room) => `<option value="${e(room.id)}" ${(item?.roomId || '') === room.id ? 'selected' : ''}>${e(room.name)}</option>`).join('')}</select>${fieldError('roomId')}</div></div><div class="mm-field" id="mm-date-field" ${selectedType === 'long' ? 'hidden' : ''}><label for="mm-memory-expiry">适用至</label><input class="mm-input" id="mm-memory-expiry" type="date" name="expiresAt" min="${e(store.today())}" value="${e(item?.expiresAt || '')}" aria-describedby="mm-error-expiresAt"><p class="mm-field-hint">截止日期当天仍适用，到期后停止使用</p>${fieldError('expiresAt')}</div><div class="mm-field"><label for="mm-memory-context">适用情境<span class="mm-optional">可选</span></label><input class="mm-input" id="mm-memory-context" name="context" maxlength="40" value="${e(item?.context || '')}" placeholder="例如：阅读、晚间休息" aria-describedby="mm-error-context">${fieldError('context')}</div><p class="mm-form-error" id="mm-form-error" role="alert"></p></form><div class="dialog-actions"><button class="secondary-button" id="mm-editor-cancel" type="button">取消</button><button class="primary-button" id="mm-editor-save" type="submit" form="mm-editor">${editing ? (confirming ? '确认并保存' : '保存修改') : '添加记忆'}</button></div>`, { initialFocus: initialField === 'expiresAt' ? '#mm-memory-expiry' : '#mm-memory-text', restoreFocus: () => { if (currentView === 'memory-detail') detailQuery('[data-mm-action="edit"]')?.focus({ preventScroll: true }); else if (currentView === 'memory') query('.mm-add').focus({ preventScroll: true }); } });
    sheet.dataset.content = 'memory-editor';
    modalQuery('#mm-editor-cancel').onclick = closeSheet;
    modalQuery('#mm-memory-type').onchange = () => { modalQuery('#mm-date-field').hidden = modalQuery('#mm-memory-type').value !== 'short'; clearEditorError('expiresAt'); };
    modalQuery('#mm-editor').addEventListener('input', (event) => { clearEditorError(event.target.name); });
    modalQuery('#mm-editor').addEventListener('change', (event) => { clearEditorError(event.target.name); });
    modalQuery('#mm-editor').onsubmit = (event) => {
      event.preventDefault();
      clearAllEditorErrors();
      const form = modalQuery('#mm-editor');
      const nextType = form.elements.type.value;
      const draft = { text: form.elements.text.value.trim(), type: nextType, roomId: form.elements.roomId.value || null, context: form.elements.context.value.trim(), expiresAt: nextType === 'short' ? form.elements.expiresAt.value : null };
      if (!editing) draft.visibility = form.elements.visibility.value;
      if (confirming) draft.confirmUnderstanding = true;
      const result = editing ? store.update(item.id, draft) : store.create(draft);
      if (!result.ok) { showEditorError(result.field, result.error || '暂时无法保存，请重试'); return; }
      const savedId = result.id || result.item?.id || item?.id;
      closeSheet();
      if (!editing && savedId) openDetail(savedId);
      else refresh(true);
      toast(editing ? (confirming ? '已确认这条理解' : '记忆已更新') : '已添加记忆');
    };
  }

  function clearEditorError(field) {
    if (!field) return;
    const error = modalQuery(`#mm-error-${field}`);
    if (error) error.textContent = '';
    const input = modalQuery(`#mm-editor [name="${field}"]`);
    input?.removeAttribute('aria-invalid');
    const general = modalQuery('#mm-form-error');
    if (general) general.textContent = '';
  }
  function clearAllEditorErrors() { sheet.querySelectorAll('.mm-field-error,.mm-form-error').forEach((element) => { element.textContent = ''; }); sheet.querySelectorAll('[aria-invalid]').forEach((element) => element.removeAttribute('aria-invalid')); }
  function showEditorError(field, message) {
    const input = field ? modalQuery(`#mm-editor [name="${field}"]`) : null;
    const target = field ? modalQuery(`#mm-error-${field}`) : null;
    (target || modalQuery('#mm-form-error')).textContent = message;
    if (input) { input.setAttribute('aria-invalid', 'true'); input.focus(); }
  }

  function chooseType(next) { if (next === type) return; type = next; renderMain(true, true); }
  function resetFilters() { type = 'all'; filter = { scope: 'all', state: 'current' }; renderMain(true, true); }
  function clearSearch() { search = ''; query('#mm-search').value = ''; renderMain(true, true); query('#mm-search').focus({ preventScroll: true }); }
  function mainClick(event) {
    const card = event.target.closest('[data-memory-id]');
    if (card) { openDetail(card.dataset.memoryId); return; }
    const tab = event.target.closest('[data-mm-tab]');
    if (tab) { chooseType(tab.dataset.mmTab); return; }
    const action = event.target.closest('[data-mm-action]')?.dataset.mmAction;
    if (action === 'add') showEditor();
    if (action === 'filter') showFilters();
    if (action === 'clear-search') clearSearch();
    if (action === 'reset-filters') resetFilters();
  }
  function startCorrection() {
    const id = detailId;
    let snapshot = JSON.stringify(draftItem());
    onConverse?.({ item: draftItem(), today: store.today(), onConfirm: (plan) => {
      if (detailId !== id || !detailDraft || JSON.stringify(draftItem()) !== snapshot) return false;
      const updated = applyVoiceDraft(plan);
      if (updated) snapshot = JSON.stringify(updated);
      return updated;
    }, onReturn: () => { setView('memory-detail'); renderDetail(true); detailQuery('.mm-ai-entry')?.focus({ preventScroll: true }); } });
  }
  function detailClick(event) {
    const action = event.target.closest('[data-mm-action]')?.dataset.mmAction;
    if (action === 'back') back();
    if (action === 'tell-memory') startCorrection();

  }
  function searchInput(event) { search = event.target.value; renderMain(true, true); }
  function tabKeyDown(event) {
    const tab = event.target.closest('[data-mm-tab]');
    if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const values = ['all', 'short', 'long'], index = values.indexOf(type);
    chooseType(event.key === 'Home' ? values[0] : event.key === 'End' ? values.at(-1) : values[(index + (event.key === 'ArrowRight' ? 1 : -1) + values.length) % values.length]);
    query(`[data-mm-tab="${type}"]`).focus({ preventScroll: true });
  }

  function open() { currentView = 'memory'; renderMain(true); setView('memory'); query('.mm-scroll').scrollTop = listScroll; }
  function returnToList() {
    currentView = 'memory'; detailId = null; detailBase = null; detailDraft = null;
    setView('memory'); renderMain(true); query('.mm-scroll').scrollTop = listScroll; focusCard(lastCardId);
  }
  function back() {
    if (currentView !== 'memory-detail') return;
    if (!detailDirty()) { returnToList(); return; }
    openSheet('保存修改？', '<p class="confirm-description">这条记忆有尚未保存的修改</p><div class="dialog-actions"><button class="secondary-button" id="mm-discard">不保存</button><button class="primary-button" id="mm-save-and-back">保存并返回</button></div>', { variant: 'float' });
    sheet.dataset.content = 'memory-unsaved';
    modalQuery('#mm-discard').onclick = () => { closeSheet(); returnToList(); };
    modalQuery('#mm-save-and-back').onclick = () => { closeSheet(); if (saveDetail()) returnToList(); };
  }
  function onViewChange(view) { currentView = view; if (view === 'memory') renderMain(); else if (view === 'memory-detail') renderDetail(); }
  function refresh(force = false) { if (disposed) return; renderMain(force); renderDetail(force); }
  const unsubscribe = store.subscribe(() => { if (!saving) refresh(); });
  page.addEventListener('click', mainClick);
  page.addEventListener('keydown', tabKeyDown);
  query('#mm-search').addEventListener('input', searchInput);
  detailPage.addEventListener('click', detailClick);
  detailPage.addEventListener('input', detailInput);
  detailPage.addEventListener('change', detailInput);

  refresh(true);
  return { open, back, onViewChange, refresh, destroy() { disposed = true; unsubscribe?.(); page.removeEventListener('click', mainClick); page.removeEventListener('keydown', tabKeyDown); query('#mm-search').removeEventListener('input', searchInput); detailPage.removeEventListener('click', detailClick); detailPage.removeEventListener('input', detailInput); detailPage.removeEventListener('change', detailInput); } };
}
