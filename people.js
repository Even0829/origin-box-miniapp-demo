import { createPeopleRecorder, VOICE_READING, VOICE_SAMPLE } from './people-recorder.js?v=multisource-20261104';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const normal = value => value.normalize('NFKC').trim().toLocaleLowerCase('zh-CN');
const glyph = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${({ back: '<path d="m14 5-7 7 7 7"/>', plus: '<path d="M12 5v14M5 12h14"/>', camera: '<path d="M4 7h4l2-3h4l2 3h4v13H4Z"/><circle cx="12" cy="13" r="4"/>', image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/>', face: '<path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3M8 10h.01M16 10h.01m-8 5q4 4 8 0"/>', mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8"/>', play: '<path d="m9 5 10 7-10 7V5Z"/>', pause: '<path d="M9 5v14M15 5v14"/>', stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>', chevron: '<path d="m9 5 7 7-7 7"/>' })[name] || ''}</svg>`;
const seconds = value => `${Math.max(1, Math.round(value))}秒`;
const clock = value => `00:${String(Math.floor(value)).padStart(2, '0')}`;
const blobURL = value => value?.startsWith('blob:');
const release = value => { if (blobURL(value)) URL.revokeObjectURL(value); };
const wave = () => `<span class="pp-wave" aria-hidden="true">${[9, 19, 13, 25, 17, 29, 15, 23, 11].map(height => `<i style="--bar-height:${height}px"></i>`).join('')}</span>`;

// Local profile maintenance only. Samples never enter chat, memory, or a recognition model.
export function createPeoplePage({ page, setView, openSheet, toast, onBack, onChange = () => {}, onRecord = () => {}, seedPeople = true, memberMode = false, inline = false, draftMode = false, releaseOnDestroy = true }) {
  const doc = page.ownerDocument, sheet = doc.querySelector('#sheet');
  const preview = new URLSearchParams(location.search).get('voice-preview') === '1';
  let people = [
    { id: 'person-yu', name: '小雨', photo: '', enabled: true, samples: [{ id: 'seed-yu-voice', url: VOICE_SAMPLE, duration: 5.88, preset: true }] },
    { id: 'person-mom', name: '妈妈', photo: 'assets/person-mom-photo.png', enabled: true, samples: [{ id: 'seed-mom-voice', url: VOICE_SAMPLE, duration: 5.88, preset: true }] },
    { id: 'person-dad', name: '爸爸', photo: '', enabled: false, samples: [] },
  ];
  if(!seedPeople)people=[];
  let selected = 'person-mom', session = null, generation = 0, view = '', destroyed = false;
  let player = null, playing = null, playbackToken = 0, pageScroll = 0, validationTimer = null;
  let previewFailureShown = false;
  const previewRetry = new URLSearchParams(location.search).get('voice-check') === 'retry';
  const q = selector => sheet.querySelector(selector);
  const find = id => people.find(person => person.id === id);
  const current = () => find(selected);
  const focusTab = () => (page.querySelector('[role="tab"][aria-selected="true"]') || page.querySelector('[data-pp="add"]'))?.focus({ preventScroll: true });
  const liveURLs = () => new Set(people.flatMap(person => [person.photo, ...person.samples.map(sample => sample.url)]));
  const notify = (person, label, text) => { onRecord({ scope: 'family', label, text: `${person.name} · ${text}` }); onChange(people.map(p => structuredClone(p))); };
  page.classList.add('pp-page');
  page.classList.toggle('pp-member-mode', memberMode);page.classList.toggle('pp-inline-member', inline);

  function stopPlayback() {
    playbackToken++;
    if (player) { player.pause(); player.removeAttribute('src'); player.load(); }
    player = null; playing = null;
    doc.querySelectorAll('[data-pp-play]').forEach(button => {
      button.innerHTML = glyph('play'); button.setAttribute('aria-label', button.dataset.playLabel || '试听语音'); button.removeAttribute('data-playing');
    });
  }
  async function playSample(sample, button) {
    if (playing === sample.id) { stopPlayback(); return; }
    stopPlayback(); const token = playbackToken;
    player = new Audio(sample.url); playing = sample.id;
    button.innerHTML = glyph('pause'); button.dataset.playing = 'true'; button.setAttribute('aria-label', '停止试听');
    player.onended = () => { if (token === playbackToken) stopPlayback(); };
    try { await player.play(); }
    catch { if (token === playbackToken) { stopPlayback(); toast('这段语音暂时无法播放，请重新录制或稍后重试'); } }
  }
  function sampleRows(samples, editing = false) {
    return samples.map((sample, index) => `<div class="pp-audio-row"><button class="pp-play" type="button" data-pp-play="${esc(sample.id)}" data-play-label="试听语音${index + 1}" aria-label="试听语音${index + 1}">${glyph('play')}</button><span class="pp-audio-copy"><strong>语音${index + 1}<small>${seconds(sample.duration)}</small></strong><span>${sample.preset ? '朗读样音' : '录音资料'}</span></span>${editing ? `<button class="pp-small-action" type="button" data-pp-replace="${esc(sample.id)}" aria-label="重新录制语音${index + 1}">重录</button><button class="pp-small-action pp-danger-text" type="button" data-pp-remove="${esc(sample.id)}" aria-label="删除语音${index + 1}">删除</button>` : wave()}</div>`).join('');
  }
  function render({ reset = false } = {}) {
    stopPlayback();
    const top = reset ? 0 : page.querySelector('.pp-scroll')?.scrollTop ?? pageScroll;
    const tabsLeft = page.querySelector('.pp-tabs')?.scrollLeft || 0;
    if (!find(selected)) selected = people[0]?.id || null;
    const person = current();
    page.innerHTML = `<header class="pp-header"><button class="icon-button" data-pp="back" aria-label="返回我的">${glyph('back')}</button><h1>人物多源识别</h1><span></span></header><div class="pp-tabs-row"><div class="pp-tabs device-filters" role="tablist" aria-label="家庭人物">${people.map(p => `<button type="button" role="tab" id="pp-tab-${p.id}" aria-controls="pp-person-panel" aria-selected="${p.id === selected}" tabindex="${p.id === selected ? 0 : -1}" data-person="${p.id}" title="${esc(p.name)}">${esc(p.name)}</button>`).join('')}</div><button class="pp-add-person" data-pp="add">${glyph('plus')}<span>添加人物</span></button></div><main class="pp-scroll" id="pp-person-panel" role="tabpanel" ${person ? `aria-labelledby="pp-tab-${person.id}"` : 'aria-label="人物资料"'}>${person ? `

      <section class="pp-card pp-identity" aria-label="身份信息"><div class="pp-card-heading"><h3>身份信息</h3></div><div class="pp-name-row"><span>称呼</span><strong>${esc(person.name)}</strong><button class="pp-link" data-pp="rename">修改</button></div><label class="pp-use"><span><strong>用于人物识别</strong><small>${person.enabled ? '人脸与声纹资料共同使用' : '已暂停使用，资料仍保留'}</small></span><input type="checkbox" role="switch" data-pp-use aria-label="使用${esc(person.name)}的识别资料" ${person.enabled ? 'checked' : ''}><span class="pp-switch" aria-hidden="true"></span></label></section>
      <section class="pp-card" aria-label="人脸资料"><div class="pp-card-heading"><h3>人脸资料</h3><span class="pp-source-state">${person.photo ? '照片已添加' : '未添加'}</span></div><div class="pp-face-body"><div class="pp-face-thumb${person.photo ? '' : ' is-empty'}">${person.photo ? `<img src="${esc(person.photo)}" alt="${esc(person.name)}的人脸资料照片">` : glyph('face')}</div><div class="pp-face-copy"><p>${person.photo ? (draftMode ? '照片已添加，随成员资料保存' : '已保存人脸资料照片') : '添加一张清晰的正脸照片'}</p><span>${person.photo ? '可随时更换或移除照片' : '拍摄或从手机相册中选择'}</span><div class="pp-inline-actions"><button class="pp-soft-button" data-pp="face">${person.photo ? '更换照片' : '添加人脸'}</button>${person.photo ? '<button class="pp-link pp-muted-link" data-pp="remove-face">移除</button>' : ''}</div></div></div></section>
      <section class="pp-card pp-voice-card" aria-label="声纹资料"><div class="pp-card-heading"><h3>声纹资料</h3><span class="pp-source-state">${person.samples.length ? '已录入' : '未录入'}</span></div>${person.samples.length ? `<div class="pp-audio-list">${sampleRows(person.samples)}</div><p class="pp-source-note">${draftMode ? '声纹已添加，随成员资料保存' : '已保存一段声纹资料，用于后续身份识别'}</p><button class="pp-link pp-danger-text pp-voice-edit" data-pp="remove-voice">删除声纹</button>` : `<div class="pp-voice-empty"><p>让小元多一份认识你的依据</p><span class="pp-voice-hint">读一句话，约5～8秒</span><button class="pp-soft-button" data-pp="voice">添加声纹</button></div>`}</section>
      <p class="pp-note">人物资料用于身份识别，录入不代表已识别到本人。</p><button class="pp-delete" data-pp="delete">删除人物资料</button>` : `<div class="pp-empty"><span class="pp-empty-icon">${glyph('face')}</span><h2>先添加一位家人</h2><p>填写称呼，再补充照片或声音</p><button class="pp-soft-button" data-pp="add">添加人物</button></div>`}</main><div class="pp-indicator" aria-hidden="true"></div>`;
    if(memberMode)page.querySelector('h1').textContent = '人脸与声纹';
    page.querySelector('.pp-scroll').scrollTop = top;
    page.querySelector('.pp-tabs').scrollLeft = tabsLeft;
  }
  function selectPerson(id, focus = false) {
    if (session || !find(id)) return;
    selected = id; pageScroll = 0; render({ reset: true });
    const tab = page.querySelector('[role="tab"][aria-selected="true"]'), strip = page.querySelector('.pp-tabs');
    if (tab) { strip.scrollLeft = Math.max(0, tab.offsetLeft - strip.offsetLeft - strip.clientWidth / 2 + tab.clientWidth / 2); if (focus) tab.focus({ preventScroll: true }); }
  }
  function dirty() {
    if (!session) return false;
    if (session.kind === 'name') return session.name.trim() !== session.baseName;
    if (session.kind === 'face') return session.photo !== session.basePhoto;
    return JSON.stringify(session.samples.map(sample => sample.id)) !== JSON.stringify(session.baseSamples.map(sample => sample.id));
  }
  function cleanup() {
    generation++; clearTimeout(validationTimer); validationTimer = null; stopPlayback(); recorder.cancel();
    if (session) { const retained = liveURLs(); session.created.forEach(url => { if (!retained.has(url)) release(url); }); }
    session = null;
  }
  function closeEditor() { cleanup(); sheet.close(); }
  function show(title, content, kind, initialFocus) {
    openSheet(title, content, { variant: kind === 'name' ? 'float' : 'sheet', onCancel: cancelEditor, restoreFocus: focusTab, initialFocus });
    sheet.dataset.content = `people-${kind}`;
  }
  function error(message) { const target = q('#pp-error'); if (target) target.textContent = message; }
  function updateSave() {
    const button = q('#pp-save');
    if (button) button.disabled = !dirty() || Boolean(session?.loading) || ['requesting', 'recording', 'validating'].includes(session?.stage) || Boolean(session?.failedSampleId && session.failedSampleId === session.samples?.[0]?.id);
  }
  function cancelEditor() {
    if (!session) { sheet.close(); return; }
    const wasRecording = recorder.active;
    recorder.cancel(); stopPlayback(); generation++; clearTimeout(validationTimer); validationTimer = null; session.loading = false; session.stage = 'idle';
    if (wasRecording) session.notice = '刚才的录音已停止，可以重新录制';
    if (!dirty() && !wasRecording) { closeEditor(); return; }
    openSheet('放弃这次修改？', '<p class="sheet-description">尚未保存的照片或录音将不会保留，原有资料不受影响。</p><div class="dialog-actions"><button class="secondary-button" id="pp-continue">继续编辑</button><button class="primary-button" id="pp-discard">放弃修改</button></div>', { variant: 'float', onCancel: renderEditor, restoreFocus: focusTab });
    sheet.dataset.content = 'people-discard';
    q('#pp-continue').onclick = renderEditor; q('#pp-discard').onclick = closeEditor;
  }
  function edit(kind) {
    cleanup(); const person = current();
    if (kind !== 'add' && !person) return;
    if (kind === 'voice' && person.samples.length) { toast('请先删除已有声纹，再重新录入'); return; }
    session = { kind: kind === 'add' ? 'name' : kind, personId: kind === 'add' ? null : person.id, name: kind === 'add' ? '' : person.name, baseName: kind === 'add' ? '' : person.name, photo: person?.photo || '', basePhoto: person?.photo || '', samples: [...(person?.samples || [])], baseSamples: [...(person?.samples || [])], created: new Set(), loading: false, stage: 'idle', notice: '' };
    renderEditor();
  }
  function renderEditor() {
    const s = session; if (!s) return;
    if (s.kind === 'name') {
      show(s.personId ? '修改称呼' : '添加人物', `<label class="form-label" for="pp-name">家里的称呼</label><input class="text-input" id="pp-name" value="${esc(s.name)}" maxlength="20" placeholder="例如：妈妈、小雨" autocomplete="off"><p class="pp-form-hint">用家里熟悉的称呼，之后可以修改</p><p class="form-error" id="pp-error" role="alert"></p><div class="dialog-actions"><button class="secondary-button" id="pp-cancel">取消</button><button class="primary-button" id="pp-save" disabled>${s.personId ? '保存' : '添加人物'}</button></div>`, 'name', '#pp-name');
      q('#pp-name').oninput = event => { s.name = event.target.value; error(''); updateSave(); };
    } else if (s.kind === 'face') {
      show(s.basePhoto ? `更换${s.name}的人脸照片` : `为${s.name}添加人脸`, `<div class="pp-photo-preview${s.photo ? '' : ' is-empty'}">${s.photo ? `<img src="${esc(s.photo)}" alt="人脸资料照片预览">` : glyph('face')}</div><p class="pp-photo-hint">请选择清晰、无遮挡的单人正脸照片</p><div class="pp-photo-actions"><button class="pp-photo-choice" data-photo="camera">${glyph('camera')}拍摄照片</button><button class="pp-photo-choice" data-photo="album">${glyph('image')}从相册选择</button></div><input type="file" id="pp-camera" accept="image/*" capture="user" hidden><input type="file" id="pp-album" accept="image/*" hidden><p class="form-error" id="pp-error" role="alert">${s.loading ? '正在读取照片…' : ''}</p><div class="dialog-actions"><button class="secondary-button" id="pp-cancel">取消</button><button class="primary-button" id="pp-save" disabled>${draftMode ? '添加照片' : '保存照片'}</button></div>`, 'face');
      sheet.querySelectorAll('[data-photo]').forEach(button => button.onclick = () => q(`#pp-${button.dataset.photo}`).click());
      ['camera', 'album'].forEach(kind => q(`#pp-${kind}`).onchange = event => readPhoto(event.target.files?.[0]));
    } else renderVoiceEditor();
    q('#pp-cancel').onclick = cancelEditor; q('#pp-save').onclick = save;
    updateSave();
  }
  function renderVoiceEditor() {
    const s = session, active = s.stage === 'recording', requesting = s.stage === 'requesting';
    if (s.stage === 'validating') {
      show('检查声纹资料', `<div class="pp-voice-check" role="status" aria-live="polite"><span class="pp-check-spinner" aria-hidden="true"></span><h3>正在检查录音…</h3><p>${draftMode ? '检查通过后，会加入待保存的成员资料' : '检查通过后，会自动保存声纹资料'}</p></div><div class="dialog-actions"><button class="secondary-button" id="pp-cancel">取消</button><button class="primary-button" id="pp-save" disabled>正在检查</button></div>`, 'voice');
      sheet.dataset.voiceStage = 'validating'; return;
    }
    delete sheet.dataset.voiceStage;
    show(`添加${s.name}的声纹资料`, `<div class="pp-voice-guide"><span>用平常的声音，读一句话</span><p>${VOICE_READING}</p><small>约5～8秒，读完即可结束</small></div>${preview ? '<p class="pp-preview-note">朗读预览，不会开启麦克风</p>' : ''}<div class="pp-recorder ${active ? 'is-recording' : ''}" aria-label="录音区域"><div class="pp-record-wave">${wave()}</div><div class="pp-record-clock"><strong id="pp-elapsed">00:00</strong><span>最长30秒</span></div><button class="pp-record-button" id="pp-record" ${requesting ? 'disabled' : ''}>${glyph(active ? 'stop' : 'mic')}<span>${active ? '结束录音' : requesting ? '正在准备…' : s.samples.length ? '重新录制' : '开始录音'}</span></button><p id="pp-record-hint" role="status">${active ? '正在录音，读完后点击结束' : requesting ? '请允许使用麦克风' : esc(s.notice || '请由本人在安静环境下录入')}</p></div><div class="pp-draft-heading"><h3>语音资料</h3><span>${s.samples.length ? '已录好一段' : '尚未录入'}</span></div><div class="pp-draft-samples">${s.samples.length ? sampleRows(s.samples) : '<p class="pp-draft-empty">录好后可以试听，再决定是否保存</p>'}</div><p class="form-error" id="pp-error" role="alert"></p><div class="dialog-actions"><button class="secondary-button" id="pp-cancel">取消</button><button class="primary-button" id="pp-save" disabled>${draftMode ? '检查并添加' : '保存声纹'}</button></div>`, 'voice');
    q('#pp-record').onclick = () => active ? recorder.stop() : startRecording();
    sheet.querySelectorAll('[data-pp-play]').forEach(button => { button.disabled = active || requesting; button.onclick = () => { if (!recorder.active) playSample(s.samples.find(sample => sample.id === button.dataset.ppPlay), button); }; });
    sheet.querySelectorAll('[data-pp-replace]').forEach(button => { button.disabled = active || requesting; button.onclick = () => startRecording(button.dataset.ppReplace); });
    sheet.querySelectorAll('[data-pp-remove]').forEach(button => { button.disabled = active || requesting; button.onclick = () => { stopPlayback(); s.samples = s.samples.filter(sample => sample.id !== button.dataset.ppRemove); renderEditor(); }; });
  }
  async function readPhoto(file) {
    const s = session; if (!file || !s || s.kind !== 'face') return;
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') { error('请选择 JPG、PNG 或其他常用照片格式'); return; }
    if (file.size > 10 * 1024 * 1024) { error('照片不能超过10MB，请选择较小的照片'); return; }
    const token = ++generation, url = URL.createObjectURL(file); s.created.add(url); s.loading = true; updateSave(); error('正在读取照片…');
    const image = new Image(); image.src = url;
    try { await image.decode(); if (!image.naturalWidth || !image.naturalHeight) throw new Error(); }
    catch { release(url); s.created.delete(url); if (session === s && token === generation) { s.loading = false; updateSave(); error('这张照片无法读取，请重新选择'); } return; }
    if (session !== s || token !== generation || destroyed) { release(url); return; }
    s.photo = url; s.loading = false; renderEditor();
  }
  async function startRecording(replaceId = null) {
    const s = session; if (!s || s.kind !== 'voice' || recorder.active || s.stage === 'validating') return;
    stopPlayback(); s.replaceId = replaceId; s.stage = 'requesting'; s.notice = ''; renderEditor();
    const ok = await recorder.start();
    if (session === s && ok) { s.stage = 'recording'; renderEditor(); }
  }
  const recorder = createPeopleRecorder({ preview,
    onTick(elapsed, level) {
      if (session?.kind !== 'voice') return;
      const timer = q('#pp-elapsed'); if (timer) timer.textContent = clock(elapsed);
      q('.pp-record-wave')?.style.setProperty('--voice-level', String(level));
    },
    onFinish(sample, reason) {
      const s = session;
      if (destroyed || !s || s.kind !== 'voice') { release(sample.url); return; }
      s.created.add(sample.url);
      s.samples = [sample];
      s.failedSampleId = null;
      s.stage = 'idle'; s.replaceId = null;
      s.notice = reason === 'limit' ? '已录满30秒，可以试听后保存' : reason === 'interrupted' ? '录音已中断，已保留本次录到的内容，请试听检查' : '这一段录好了，可以试听后保存';
      renderEditor();
    },
    onError(message) { if (session?.kind === 'voice') { session.stage = 'idle'; renderEditor(); error(message); } },
  });
  function save() {
    const s = session; if (!s || s.loading || recorder.active || s.stage === 'validating' || !dirty()) return;
    const person = find(s.personId);
    if (s.kind === 'name') {
      const name = s.name.trim();
      if (!name) { error('请填写人物称呼'); return; }
      if ([...name].length > 20) { error('称呼不能超过20个字'); return; }
      if (people.some(p => p.id !== s.personId && normal(p.name) === normal(name))) { error('已有同名人物，请使用不同的称呼'); return; }
      if (person) { person.name = name; notify(person, '人物称呼已修改', '称呼已更新，识别资料保持原有归属'); }
      else { const added = { id: crypto.randomUUID(), name, enabled: true, photo: '', samples: [] }; people.push(added); selected = added.id; notify(added, '人物资料已添加', '已创建人物，识别资料待补充'); }
    } else if (!person) { closeEditor(); toast('这位人物已不存在'); return; }
    else if (s.kind === 'face') { const old = person.photo; person.photo = s.photo; if (old !== s.photo) release(old); notify(person, '人脸资料已更新', '照片已保存，尚不代表已识别到本人'); }
    else {
      const sample = s.samples[0];
      if (!sample || s.failedSampleId === sample.id) return;
      stopPlayback(); s.stage = 'validating'; renderEditor(); const token = ++generation;
      // Local preview validation only: the real quality / voiceprint model is not connected.
      validationTimer = setTimeout(() => {
        validationTimer = null;
        if (destroyed || session !== s || generation !== token || !sheet.open || find(s.personId) !== person) return;
        const invalid = !Number.isFinite(sample.duration) || sample.duration <= 0 || (sample.blob && sample.blob.size === 0);
        if (invalid || (previewRetry && !previewFailureShown)) {
          previewFailureShown = true; s.stage = 'idle'; s.failedSampleId = sample.id; s.notice = '这段录音暂不能用于建立声纹，请重新录制';
          renderEditor(); error('没能获取到清晰的有效语音，请在安静环境下重新录制。'); return;
        }
        person.samples = [{ ...sample, verification: 'local-preview' }];
        notify(person, '声纹资料已保存', '已通过本地预览检查并保存一段录音，真实声纹模型尚未接入');
        closeEditor(); render(); focusTab(); toast(draftMode ? '声纹已添加，保存成员后生效' : '声纹资料已保存');
      }, 1200);
      return;
    }
    closeEditor(); render(); focusTab(); toast(s.kind === 'name' ? '人物信息已保存' : s.kind === 'face' ? (draftMode ? '照片已添加，保存成员后生效' : '照片已保存') : '录音资料已保存');
  }
  function confirmAction(title, description, label, action) {
    stopPlayback();
    openSheet(title, `<p class="sheet-description">${description}</p><div class="dialog-actions"><button class="secondary-button" id="pp-keep">取消</button><button class="primary-button destructive-button" id="pp-confirm">${label}</button></div>`, { variant: 'float', restoreFocus: focusTab });
    sheet.dataset.content = 'people-confirm'; q('#pp-keep').onclick = () => sheet.close(); q('#pp-confirm').onclick = () => { action(); sheet.close(); render(); focusTab(); };
  }
  function onClick(event) {
    const tab = event.target.closest('[data-person]'); if (tab) { selectPerson(tab.dataset.person); return; }
    const play = event.target.closest('[data-pp-play]'); if (play) { const sample = current()?.samples.find(item => item.id === play.dataset.ppPlay); if (sample) playSample(sample, play); return; }
    const action = event.target.closest('[data-pp]')?.dataset.pp, person = current();
    if(memberMode&&['add','rename','delete'].includes(action)){toast('请在成员档案中维护基本信息');return;}
    if (action === 'back') onBack();
    if (action === 'add') edit('add');
    if (action === 'rename') edit('name');
    if (action === 'face') edit('face');
    if (action === 'voice') edit('voice');
    if (action === 'remove-voice' && person) confirmAction('删除声纹资料？', '将移除这段声纹录音，人脸资料和人物信息保留。删除后可以重新录入。', '删除声纹', () => { person.samples.forEach(sample => release(sample.url)); person.samples = []; notify(person, '声纹资料已删除', '语音资料已移除，人脸资料保留'); });
    if (action === 'remove-face' && person) confirmAction('移除人脸照片？', '只移除这位人物的人脸照片，声纹资料和既有记录保留。', '移除照片', () => { release(person.photo); person.photo = ''; notify(person, '人脸照片已移除', '声纹资料与人物档案保留'); });
    if (action === 'delete' && person) confirmAction(`删除${person.name}的资料？`, '将移除该人物的人脸照片、语音及人物档案。已有记忆和历史记录会保留。', '删除资料', () => { release(person.photo); person.samples.forEach(sample => release(sample.url)); people = people.filter(p => p.id !== person.id); notify(person, '人物资料已删除', '两类识别资料已移除，既有记忆与历史保留'); });
  }
  function onChangeInput(event) {
    if (!event.target.matches('[data-pp-use]')) return;
    const person = current(); if (!person) return;
    person.enabled = event.target.checked;
    notify(person, person.enabled ? '人物识别资料已恢复' : '人物识别资料已停用', person.enabled ? '已恢复资料使用，账号权限保持不变' : '暂停两类资料使用，原资料保留'); render();
  }
  function onKeydown(event) {
    const tab = event.target.closest('[data-person]'); if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); const at = people.findIndex(p => p.id === tab.dataset.person), step = event.key === 'ArrowRight' ? 1 : -1;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? people.length - 1 : (at + step + people.length) % people.length;
    selectPerson(people[next].id, true);
  }
  function interruptCapture() {
    stopPlayback();
    if (session?.stage === 'requesting') {
      recorder.cancel(); session.stage = 'idle'; session.notice = '录音准备已中断，返回后可重新录制'; renderEditor();
    } else if (recorder.active) recorder.stop('interrupted');
  }
  const onVisibility = () => { if (doc.hidden) interruptCapture(); };
  const onPageHide = () => { stopPlayback(); recorder.cancel(); if (session) { session.stage = 'idle'; session.notice = '录音已停止，请检查尚未保存的内容'; } };
  const onSheetClose = () => { if (!sheet.open && session) cleanup(); };
  page.addEventListener('click', onClick); page.addEventListener('change', onChangeInput); page.addEventListener('keydown', onKeydown);
  doc.addEventListener('visibilitychange', onVisibility); window.addEventListener('pagehide', onPageHide); sheet.addEventListener('close', onSheetClose);
  render();
  return {
    retainMedia() { releaseOnDestroy = false; },
    setName(name) { const person=current(); if(person&&person.name!==name){person.name=name;if(!session)render();} },
    openFor(member) { cleanup(); people=[{id:member.id,name:member.name,photo:member.photo||'',samples:structuredClone(member.samples||[]),enabled:member.enabled!==false}]; selected=member.id;setView('people');render({reset:true}); },
    open() { setView('people'); render(); page.querySelector('[data-pp="back"]').focus({ preventScroll: true }); },
    back: onBack,
    onViewChange(next) { if (view === 'people') pageScroll = page.querySelector('.pp-scroll')?.scrollTop || 0; if (next !== 'people') cleanup(); view = next; },
    getSummary() { return { total: people.length, enabled: people.filter(p => p.enabled).length }; },
    getRecognitionProfiles() { return people.map(({ id, name, photo, enabled, samples }) => ({ id, name, photo, enabled, sources: [photo ? 'face' : null, samples.length ? 'voice' : null].filter(Boolean) })); },
    getParticipants() { return people.map(({ id, name, enabled }) => ({ id, name, enabled })); },
    destroy() { destroyed = true; cleanup(); recorder.destroy(); if(releaseOnDestroy)people.forEach(p => { release(p.photo); p.samples.forEach(sample => release(sample.url)); }); page.removeEventListener('click', onClick); page.removeEventListener('change', onChangeInput); page.removeEventListener('keydown', onKeydown); doc.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('pagehide', onPageHide); sheet.removeEventListener('close', onSheetClose); },
  };
}
