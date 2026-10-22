import { scenarioInsightExamples } from './scenario-preview-data.js?v=away-check-20261021';
import { evaluateHomePresence } from './home-presence.js?v=away-check-20261021';
import { previewNow } from './preview-clock.js';
import { createScenarioInsights, insightFingerprint } from './scenario-insights.js?v=scene-insights-20261021';

const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const timeFormat = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false });
const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
const timeText = (at) => timeFormat.format(at);
const definitions = [
  { id: 'away', title: '外出照看', goal: '全家离家后，家里有照应', intro: '先帮你检查家里的情况，再按本次范围留意变化。需要你确认的事，会单独列出来。', active: '正在照看', action: '开始照看', tone: 'teal', paths: '<path d="m4 10 8-6 8 6v9H4v-9Z"/><path d="M9 19v-6h6v6M15 9h5M18 7l2 2-2 2"/>' },
  { id: 'sleep', title: '睡眠守护', goal: '安心休息，少一些打扰', intro: '结合家里此刻的情况，照料休息环境，也不打扰仍在活动的家人。', active: '持续守护', action: '开始守护', tone: 'blue', paths: '<path d="M18.8 14.3A7.5 7.5 0 0 1 9.7 5.2a7.5 7.5 0 1 0 9.1 9.1Z"/><path d="M16 4v4M14 6h4"/>' },
  { id: 'elder', title: '长辈关怀', goal: '多一份照应，保持日常节奏', intro: '告诉我需要照应的家人，我会从基础照料开始，接续已经明确的生活安排。', active: '持续关怀', action: '开始关怀', tone: 'warm', paths: '<path d="M20 10c0 4.3-8 9-8 9S4 14.3 4 10a4 4 0 0 1 8-1 4 4 0 0 1 8 1Z"/><path d="M9 12h6M12 9v6"/>' },
];
const svgFor = (definition) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${definition.paths}</svg>`;
export const careSceneIcon = (id) => { const definition = definitions.find((item) => item.id === id); return definition ? svgFor(definition) : ''; };

const clone = value => structuredClone(value);
const basePolicy = () => ({ focusIds: null, priorityDeviceIds: [], protectIds: [], keepLights: false, quiet: false, durationMs: null, reminder: null });
const mergePolicy = (policy, patch = {}) => ({ ...clone(policy), ...clone(patch) });

/** Shared local data and a small intent model demonstrate the care loop. */
export function createHomeScenarios({ container, store, getRooms = () => [], getPeople = () => [], getMemories = () => [], onRemember, openSheet, toast, onService, onRecord, onServiceDetail } = {}) {
  const doc = container.ownerDocument, sheet = doc.querySelector('#sheet');
  const insights = createScenarioInsights({ sheet, getMemories });
  const jobs = new Map(), preferences = new Map(), timers = new Set();
  let serial = 0, destroyed = false, currentPanel = null, returnHandler = null, lastPerson = '', proposal = null;
  const e = escapeHTML, now = () => previewNow(), q = selector => sheet.querySelector(selector);
  const rooms = () => (getRooms() || []).filter(room => room?.id && room?.name);
  const people = () => (getPeople() || []).filter(person => person?.id && person?.name && person.enabled !== false);
  const devices = () => store.getDevices();
  const def = id => definitions.find(item => item.id === id);
  const roomName = id => rooms().find(room => room.id === id)?.name || '原空间已移除';
  const personName = id => people().find(person => person.id === id)?.name || '家里的长辈';
  const deviceLabel = device => device.name.startsWith(roomName(device.roomId)) ? device.name : `${roomName(device.roomId)}${device.name}`;
  const active = job => Boolean(job && ['active', 'running', 'partial'].includes(job.state));
  const editable = job => Boolean(job && (job.state === 'draft' || active(job)));
  const isDraft = job => job?.state === 'draft';
  const currentJob = id => jobs.get(id);
  const schedule = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (!destroyed) fn(); }, ms); timers.add(id); return id; };
  const presence = () => evaluateHomePresence(rooms(), devices());
  const prefKey = (id, personId) => `${id}:${id === 'elder' ? personId : 'family'}`;
  const sceneMemory = job => {
    const item = preferences.get(prefKey(job.scenarioId, job.personId));
    return item && (getMemories() || []).find(memory => memory.id === item.memoryId);
  };
  const validMemory = memory => memory?.enabled === true && !memory.expired && memory.understanding === 'clear' && memory.visibility === 'family';
  const pref = (id, personId) => {
    const item = preferences.get(prefKey(id, personId));
    const memory = item && (getMemories() || []).find(memory => memory.id === item.memoryId && validMemory(memory) && memory.context?.includes(def(id).title));
    if (!memory) return null;
    if (memory.text !== item.storedText) {
      const revised = understand({ scenarioId: id, personId, policy: basePolicy() }, memory.text);
      if (revised.question || revised.commands.length) return null;
      item.patch = revised.patch; item.text = memory.text; item.storedText = memory.text;
      insights.note({ key: prefKey(id, personId), memory, effect: futureEffect(id, revised.patch), source: memory.evidence?.[0]?.text || memory.text, semanticKey: policyKey(revised.patch) });
    }
    return item;
  };
  const policyKey = patch => JSON.stringify(mergePolicy(basePolicy(), patch));
  const initialPolicy = (id, personId) => mergePolicy(basePolicy(), pref(id, personId)?.patch);
  const isObserved = room => {
    const sources = devices().filter(device => device.roomId === room.id && device.inputCapabilities?.includes('在场'));
    return room.observed && (!sources.length || sources.some(device => device.online && device.permissions?.read !== false));
  };
  const focusRooms = (id, policy) => {
    if (policy.focusIds) return rooms().filter(room => policy.focusIds.includes(room.id));
    if (id === 'sleep') {
      const resting = rooms().filter(room => isObserved(room) && /休息|睡眠|入睡/u.test(room.activity || ''));
      if (resting.length) return resting;
    }
    return rooms();
  };
  function snapshot(id, policy) {
    const scope = focusRooms(id, policy), ids = scope.map(room => room.id);
    const related = devices().filter(device => ids.includes(device.roomId));
    const sensors = related.filter(device => device.readings?.some(reading => ['temperature', 'humidity'].includes(reading.key)));
    const rows = scope.map(room => {
      const local = sensors.filter(device => device.roomId === room.id && device.online && device.permissions?.read !== false);
      const read = key => local.flatMap(device => (device.readings || []).map(reading => ({ ...reading, device }))).find(reading => reading.key === key && Number.isFinite(reading.value));
      const temperature = read('temperature'), humidity = read('humidity');
      return { roomId: room.id, title: room.name, source: [...new Set([temperature?.device.name, humidity?.device.name].filter(Boolean))].join('、') || '环境信息暂不可用', value: [temperature ? `${temperature.value}℃` : '温度待更新', humidity ? `${humidity.value}%` : '湿度待更新'].join(' · '), temperature: temperature?.value, humidity: humidity?.value, sensorId: temperature?.device.id, limited: !temperature || !humidity };
    });
    const inUse = rooms().filter(room => isObserved(room) && !/暂无活动|未检测到|待更新/u.test(`${room.presence} ${room.activity}`) && /在场/u.test(room.presence || ''));
    const resting = scope.filter(room => isObserved(room) && /休息|睡眠|入睡/u.test(room.activity || ''));
    const unavailable = related.filter(device => !device.online || device.permissions?.read === false);
    return { scope, related, rows, inUse, resting, unavailable, readable: related.filter(device => device.online && device.permissions?.read !== false) };
  }
  function knownMemories(id, policy, personId, snap) {
    const tags = id === 'away' ? /外出|离家|照看/u : id === 'sleep' ? /睡眠|休息|睡前|夜间/u : /关怀|照料|提醒|午休/u;
    const subjects = new Set(['家庭共同安排', '家庭空间', ...(id === 'elder' && personId ? [personName(personId)] : [])]);
    return (getMemories() || []).filter(memory => validMemory(memory) && subjects.has(memory.subject) && tags.test(`${memory.text} ${memory.context}`) && (!memory.roomId || snap.scope.some(room => room.id === memory.roomId))).filter(memory => !/客厅.*休息/u.test(memory.text) || snap.resting.some(room => room.id === 'living') || policy.focusIds?.includes('living')).slice(0, 2);
  }
  function plan(id, policy, personId, job = null) {
    const s = snapshot(id, policy), names = s.scope.map(room => room.name).join('、'), subject = personName(personId);
    const remembered = job?.pendingMemoryDisable ? null : pref(id, personId), memories = knownMemories(id, policy, personId, s);
    const priority = (policy.priorityDeviceIds || []).map(id => s.related.find(device => device.id === id)).filter(Boolean);
    const protectedNames = policy.protectIds.map(roomName).join('、');
    const environmentAvailable = s.rows.some(row => Number.isFinite(row.temperature) || Number.isFinite(row.humidity));
    const hasLightRequest = Boolean(job?.commands?.some(command => s.related.some(device => device.id === command.deviceId && device.type === 'light')) || job?.controlledIds?.some(id => s.related.some(device => device.id === id && device.type === 'light')));
    const reminder = policy.reminder && !policy.quiet;
    const reminderNote = reminder ? `本次约定：${policy.reminder.text} · ${job?.reminderDue ? timeText(job.reminderDue) : `${policy.reminder.delayMs / 60000}分钟后`}` : '';
    let lead, items;
    if (id === 'away') {
      lead = job && !isDraft(job) ? '我会继续照看离家后的家庭变化，发现需要处理的事再介入。' : '离家后，我会检查可能遗漏的事项，照看家庭环境，并留意无人期间的异常。';
      items = [
        { title: '检查离家遗漏', detail: `留意可能忘关或无需继续运行的设备，结合在场信息和家庭安排，判断是否需要关停或调整。${policy.keepLights ? '你要求保留的照明维持原样。' : ''}`, note: policy.keepLights ? `你的安排：保留${protectedNames || '现有'}照明` : '' },
        { title: '照看家庭环境', detail: environmentAvailable ? '关注环境持续偏离适宜状态的变化，结合可用设备与授权判断是否调节，并跟进处理效果。' : '获得可靠的环境信息后，再判断是否需要调节；信息不足时先保留待核对，不贸然调整。' },
        { title: '留意无人期间的异常', detail: '结合已接入的信息核对离家状态与异常信号，按授权处理；需要你介入时，再提醒关键情况。' },
      ];
    } else if (id === 'sleep') {
      lead = '我会照看休息环境，减少用灯、设备和提醒带来的打扰。';
      items = [
        { title: '照料休息环境', detail: environmentAvailable ? '结合休息状态留意环境变化，需要时选择温和的调节方式，并跟进是否改善。' : '有可靠的环境反馈后，再判断是否需要调节；休息位置不明确时先关注家庭环境。' },
        { title: '减少用灯与设备打扰', detail: policy.keepLights ? '你要求保留的照明保持原样；其他调节结合休息位置与家人的活动，减少不必要的打扰。' : '结合休息位置和家人的活动，判断是否需要调整照明或设备声响，照顾仍在使用的空间。', note: policy.keepLights ? `你的安排：保留${protectedNames || '现有'}照明` : hasLightRequest ? '按你本次确认的用灯安排照料，实际结果以设备反馈为准' : '' },
        { title: reminder ? '接续约定的提醒' : '减少不必要的提醒', detail: reminder ? '按你约定的内容与时间准备提醒，反馈单独跟进；休息期间不额外增加其他生活提醒。' : '休息期间暂停生活提醒；有唤醒等明确需要时，再补充安排。', note: reminderNote },
      ];
    } else {
      lead = personId ? `我会结合${subject}的生活习惯与已知需要，照看日常环境和生活安排。` : '先选择需要照应的家人，我会结合已知习惯和需要安排照料。';
      items = [
        { title: '照料日常环境', detail: '结合已知位置和生活习惯留意环境变化，需要时选择合适的调节方式，避免影响正在做的事。' },
        { title: '接续生活安排', detail: policy.quiet ? '尊重家人自己的生活节奏，不固定增加喝水或活动提醒；有明确需要时再补充。' : reminder ? '按已明确的生活安排准备提醒，避免重复打扰；实际提醒结果单独反馈。' : '接续已有的生活安排；需要新增提醒时，先明确内容与时机，减少无依据的打扰。', note: reminderNote || (policy.quiet ? '按你已确认的安排，不增加固定生活提醒' : '') },
        { title: '留意需要照应的变化', detail: '结合可用的活动与环境信息核对异常变化，判断是否需要帮助；重要情况再与你沟通。' },
      ];
    }
    if (policy.focusIds) lead += ` 这次重点关注${names || '原空间（待核对）'}。`;
    if (remembered) lead += ' 已接上你之前确认的照料安排。';
    const readableControls = s.readable.filter(device => typeof device.power === 'boolean').sort((a, b) => Number(priority.some(item => item.id === b.id)) - Number(priority.some(item => item.id === a.id)));
    const status = presence();
    const references = [
      { title: '当前空间环境', value: s.rows.map(row => `${row.title}：${row.value}（${row.source}）`).join('；') || '暂无可用空间环境信息', source: '已接入的环境来源' },
      { title: '当前设备反馈', value: readableControls.map(device => `${deviceLabel(device)}：${device.statusText || device.cardStatusText || (device.power ? '运行中' : '已关闭')}`).join('；') || '暂无可读取的设备运行信息', source: '设备当前反馈' },
      { title: '在场与位置依据', value: id === 'away' ? status.state === 'vacant' ? '现有信息已确认家中无人' : status.state === 'occupied' ? `${status.names.join('、')}有在场反馈，暂不按全屋无人执行动作` : '在场信息不完整，未检测到人不等于确认无人' : id === 'elder' ? policy.focusIds ? `本次关注范围来自你的补充：${names}；不由普通在场信号推定人物身份` : '尚未明确关怀对象所在空间，家庭环境读数不代表其所在房间' : s.resting.length ? `当前休息活动参考：${s.resting.map(room => room.name).join('、')}` : '休息位置尚不明确，先参考家庭环境', source: '已接入的信息与用户补充' },
    ];
    if (s.unavailable.length) references.push({ title: '待核对的来源', value: s.unavailable.map(deviceLabel).join('、') + '反馈不可用，保留待核对', source: '连接与读取权限' });
    if (id === 'away') references.push({ title: '安全照看的范围', value: '门窗、烟雾、燃气及漏水信息尚未接入，相关风险暂不可判断；普通在场反馈不直接认定为入侵或家人回家', source: '当前能力边界' });
    if (id === 'elder') references.push({ title: '关怀的范围', value: '仅参考已接入的活动与环境信息，不据此识别跌倒或作医疗判断；提醒准备与本人收到分别确认', source: '当前能力边界' });
    const memoryTexts = [...new Set([remembered?.text, ...memories.map(memory => memory.text)].filter(Boolean))];
    if (memoryTexts.length) references.push({ title: '已确认的家庭安排', value: memoryTexts.join('；'), source: '有效家庭记忆' });
    return { ...s, lead, items, references, remembered, memories, subject, names };
  }
  const planMarkup = p => `<div class="hsc-care-plan">${p.items.map((item, i) => `<article><span class="hsc-plan-index">${i + 1}</span><div><strong>${e(item.title)}</strong><p>${e(item.detail)}</p>${item.note ? `<small>${e(item.note)}</small>` : ''}</div></article>`).join('')}</div><details class="hsc-reference"><summary>参考的家庭信息<span class="hsc-reference-chevron" aria-hidden="true"></span></summary><div>${p.references.map(row => `<section><h4>${e(row.title)}</h4><p>${e(row.value)}</p></section>`).join('')}<p class="hsc-reference-caption">这里是当前判断依据，具体执行和结果单独保留。</p></div></details>`;
  function headline(id, p, running = false) {
    return `<div class="hsc-ai-heading"><span class="hsc-ai-label">小元${running ? '正在这样照料' : '准备这样照料'}</span></div><p class="hsc-ai-lead">${e(p.lead)}</p>`;
  }
  function futureEffect(id, patch) {
    const changes = [];
    if (patch.focusIds?.length) changes.push(`重点照料${patch.focusIds.map(roomName).join('、')}`);
    if (patch.priorityDeviceIds?.length) changes.push(`优先核对${patch.priorityDeviceIds.map(id => store.get(id)?.name).filter(Boolean).join('、')}，其他设备与空间继续检查`);
    if (patch.keepLights) changes.push(`保留${patch.protectIds?.length ? patch.protectIds.map(roomName).join('、') + '的' : '现有'}照明，不额外调灯`);
    else if (patch.keepLights === false) changes.push('按当前使用情况照料，不固定保留照明');
    if (patch.quiet) changes.push('不增加生活提醒，继续留意环境');
    if (patch.reminder) changes.push(`按约定准备“${patch.reminder.text}”提醒`);
    if (patch.durationMs) changes.push(`按约定照料${patch.durationMs / 60000}分钟`);
    return `下次${def(id).title}时，会${changes.join('；') || '参考这一安排'}。`;
  }
  function personPicker(selected) {
    return `<label class="hsc-person-picker"><span>需要照应的家人</span><select id="hsc-person" aria-label="关怀对象"><option value="">请选择</option>${people().map(person => `<option value="${e(person.id)}" ${selected === person.id ? 'selected' : ''}>${e(person.name)}</option>`).join('')}</select></label>${!people().length ? '<p class="hsc-field-hint">还没有可选人物，请先在“我的—人物识别”补充人物资料。</p>' : ''}`;
  }
  function frame(content) { sheet.dataset.content = content; }
  function closeFlow() {
    insights.finishReading();
    const back = returnHandler; returnHandler = null; currentPanel = null; proposal = null;
    sheet.close(); back?.();
  }
  function openStart(id, existingDraft = null) {
    const d = def(id), personId = id === 'elder' && people().some(person => person.id === lastPerson) ? lastPerson : '';
    const draft = existingDraft || { scenarioId: id, personId, state: 'draft', policy: initialPolicy(id, personId), patch: {}, commands: [], supplements: [], pendingPreference: null, busy: false };
    currentPanel = { type: 'start', id, personId: draft.personId, job: draft }; proposal = null;
    openSheet(d.title, `${id === 'elder' ? personPicker(draft.personId) : ''}<div id="hsc-start-plan"></div><p class="hsc-start-note">${id === 'away' ? '回家后可结束本次照看' : id === 'sleep' ? '休息结束后可结束守护' : '需要时可结束关怀'}</p><p id="hsc-start-error" class="hsc-field-hint" role="alert" hidden></p><div class="dialog-actions hsc-start-actions"><button type="button" class="secondary-button" id="hsc-start-supplement">补充或纠正</button><button type="button" class="primary-button" id="hsc-start">${d.action}</button></div>`, { onCancel: closeFlow, restoreFocus: () => entranceFocus(id) });
    frame('home-scenario'); renderStart(draft);
    if (id === 'elder') q('#hsc-person').onchange = event => {
      if (currentPanel?.type !== 'start' || draft.busy) return;
      const nextPerson = event.target.value;
      if (draft.personId && draft.personId !== nextPerson) {
        draft.patch = {}; draft.commands = []; draft.supplements = []; draft.pendingPreference = null; draft.pendingMemoryDisable = null;
        toast?.('关怀对象已更换，请重新确认补充安排');
      }
      draft.personId = nextPerson; currentPanel.personId = nextPerson;
      draft.policy = mergePolicy(initialPolicy(id, nextPerson), draft.patch); renderStart(draft);
    };
    q('#hsc-start-supplement').onclick = () => openSupplement(draft, () => openStart(id, draft));
    q('#hsc-start').onclick = async () => {
      if (draft.busy || (id === 'elder' && !people().some(item => item.id === draft.personId))) return;
      draft.busy = true; renderStart(draft);
      if (draft.pendingMemoryDisable) {
        const result = await onRemember?.({ memoryId: draft.pendingMemoryDisable, enabled: false });
        if (!result?.ok) { draft.busy = false; renderStart(draft); q('#hsc-start-error').hidden = false; q('#hsc-start-error').textContent = result?.error || '暂时无法停用记忆'; return; }
        insights.forget(draft.pendingMemoryDisable);
        draft.policy = mergePolicy(basePolicy(), draft.patch);
      }
      if (draft.pendingPreference) {
        const result = await remember(draft, draft.pendingPreference);
        if (!result.ok) {
          draft.busy = false;
          if (currentPanel?.job === draft && sheet.open) { renderStart(draft); q('#hsc-start-error').hidden = false; q('#hsc-start-error').textContent = result.error; }
          return;
        }
      }
      if (destroyed || currentPanel?.job !== draft || !sheet.open) return;
      if (id === 'elder') lastPerson = draft.personId;
      sheet.close(); currentPanel = null; start(id, draft.personId, draft); openJob(jobs.get(id));
    };
  }
  function renderStart(draft) {
    const p = plan(draft.scenarioId, draft.policy, draft.personId, draft), host = q('#hsc-start-plan'); if (!host) return;
    const referenceOpen = Boolean(host.querySelector('.hsc-reference[open]'));
    const expanded = new Set([...host.querySelectorAll('details[open][data-insight-id]')].map(item => item.dataset.insightId));
    host.innerHTML = headline(draft.scenarioId, p) + planMarkup(p) + (draft.commands.length ? `<div class="hsc-start-added"><strong>开始后执行</strong>${draft.commands.map(command => `<p>${e(command.label)}，以设备反馈为准</p>`).join('')}</div>` : '') + (draft.pendingPreference ? '<p class="hsc-memory-note">开始时将保存你确认的家庭场景偏好</p>' : '') + (draft.policy.durationMs ? `<p class="hsc-start-note">本次照料${draft.policy.durationMs / 60000}分钟</p>` : '') + (draft.pendingMemoryDisable ? '<p class="hsc-memory-note">开始时停用你指出的场景记忆</p>' : '') + insights.markup(prefKey(draft.scenarioId, draft.personId));
    host.querySelector('.hsc-reference').open = referenceOpen;
    host.querySelectorAll('[data-insight-id]').forEach(item => { item.open = expanded.has(item.dataset.insightId); });
    q('#hsc-start').disabled = draft.busy || (draft.scenarioId === 'elder' && !people().some(person => person.id === draft.personId));
    q('#hsc-start-supplement').disabled = draft.busy;
    if (q('#hsc-person')) q('#hsc-person').disabled = draft.busy;
    insights.observe();
  }
  const entranceFocus = id => container.querySelector(`[data-home-scenario="${id}"]`)?.focus({ preventScroll: true });
  function append(job, title, text, extra = {}) { job.steps.push({ title, detail: text, at: now(), state: 'completed', ...extra }); job.updatedAt = now(); onRecord?.({ experienceId: job.id, kind: 'scenario-lifecycle', scope: 'family', label: title, text, at: job.updatedAt }); }
  function initialEvidence(id, p, personId) {
    return [
      { title: '本次场景委托', value: `${def(id).title}${id === 'elder' ? ` · ${personName(personId)}` : ' · 家庭基础照料'}，未预设固定时长`, at: now() },
      ...p.items.map(item => ({ title: `初始安排 · ${item.title}`, value: item.detail, at: now() })),
      ...p.references.map(row => ({ ...row, at: now() })),
      ...(p.remembered ? [{ title: '已确认的场景偏好', value: p.remembered.text, at: now() }] : []),
    ];
  }
  function serviceData(job) {
    const p = plan(job.scenarioId, job.policy, job.personId, job), d = def(job.scenarioId), ended = !active(job);
    return {
      id: job.id, experienceId: job.id, kind: 'scenario', scenarioId: job.scenarioId, scope: 'family', state: job.state, phase: ended ? 'ended' : job.busy ? 'preparing' : 'caring',
      title: ended ? `${d.title}已结束` : job.latestTitle?.startsWith(d.title) ? job.latestTitle : `${d.title} · ${job.latestTitle || '基础照料已接上'}`,
      summary: ended ? `${job.endReason === 'returned' ? '你已确认回家' : job.endReason === 'expiry' ? '已到你指定的时效' : '你结束了本次照料'}；已有设备设置与过程记录保留` : job.latestText || p.lead,
      status: ended ? '已结束' : job.busy ? '等待设备反馈' : d.active,
      reason: `你开启了${d.title}。小元结合当时可读取的空间、设备与有效家庭安排组织照料；新信息和你的补充会继续更新同一件事。`,
      evidence: clone(job.initialEvidence), steps: clone(job.steps), deviceIds: [...new Set([...p.rows.map(row => row.sensorId).filter(Boolean), ...p.unavailable.map(device => device.id), ...(job.controlledIds || [])])], controlDeviceIds: job.busy ? [...(job.pendingIds || [])] : [],
      next: ended ? '需要时可从首页重新开启' : `${job.endAt ? `本次按你的要求至${timeText(job.endAt)}；` : ''}${job.scenarioId === 'away' ? '回家后可结束照看' : job.scenarioId === 'sleep' ? '休息结束时可结束守护' : '需要时可结束关怀'}，也可告诉小元补充或纠正。`,
      at: job.updatedAt, createdAt: job.createdAt, updatedAt: job.updatedAt,
      manage: (options = {}) => { returnHandler = options.onReturn || null; openJob(job); },
      correct: ended ? null : (options = {}) => { returnHandler = options.onReturn || null; openSupplement(job, closeFlow); },
      end: ended ? null : (options = {}) => { returnHandler = options.onReturn || null; confirmEnd(job); },
    };
  }
  function publish(job) {
    if (destroyed) return;
    renderEntrances();
    if (currentPanel?.type === 'manage' && currentPanel.job === job && sheet.open) renderManagement(job);
    if (currentPanel?.type === 'start' && currentPanel.id === job.scenarioId && currentPanel.personId === job.personId && sheet.open) renderStart(currentPanel.job);
  }
  function start(id, personId, draft) {
    if (active(jobs.get(id))) { openJob(jobs.get(id)); return; }
    const policy = draft ? clone(draft.policy) : initialPolicy(id, personId), p = plan(id, policy, personId), at = now();
    const job = { awayPresenceKey: presence().key, awayPresenceState: presence().state, id: `home-scenario-${id}-${at}-${++serial}`, scenarioId: id, personId, policy, state: 'active', createdAt: at, updatedAt: at, endAt: policy.durationMs ? at + policy.durationMs : null, steps: [], initialEvidence: initialEvidence(id, p, personId), busy: false, pendingIds: [], controlledIds: [], revision: 1, demoUsed: false, snapshotKey: '', latestTitle: `${def(id).title}已开始`, latestText: p.lead, reminderPrepared: false, reminderDue: policy.reminder && !policy.quiet ? at + policy.reminder.delayMs : null };
    jobs.set(id, job);
    if (id === 'away') job.initialEvidence.unshift({ title: '开始时的在场信息', value: presence().state === 'vacant' ? '现有信息已确认无人' : presence().state === 'occupied' ? '仍有在场反馈，先检查设备与环境，不按全屋无人执行动作' : '在场信息不足，先检查设备与环境，不视为确认无人', at });
    append(job, '结合当前家庭信息安排照料', p.lead);
    append(job, '基础照料已接上', p.items.map(item => item.title).join('；'));
    if (p.remembered) append(job, '接续已确认的场景偏好', p.remembered.text);
    for (const intent of draft?.supplements || []) append(job, '开始前确认的补充', intent.text);
    job.snapshotKey = sourceKey(job);
    publish(job); toast?.(`${def(id).title}已开始`);
    if (draft?.commands.length) runCommands(job, draft.commands, '执行你开始前确认的安排');
    schedule(() => advancePreviewSources(job), 12000);
  }
  function managementMarkup(job) {
    const p = plan(job.scenarioId, job.policy, job.personId, job), validPerson = job.scenarioId !== 'elder' || people().some(person => person.id === job.personId);
    return `${headline(job.scenarioId, p, true)}<div class="hsc-live-meta"><span><i></i>${active(job) ? job.busy ? '等待设备反馈' : def(job.scenarioId).active : '本次照料已结束'}</span><span>${e(timeText(job.createdAt))}开始${job.endAt ? ` · 至${e(timeText(job.endAt))}` : ''}</span></div>${!validPerson ? '<p class="hsc-scope-warning">原人物资料已不可用，请更换关怀对象。</p>' : ''}${job.scenarioId === 'elder' ? `<button class="hsc-change-person" id="hsc-change-person">关怀对象：${e(personName(job.personId))}<span>更换</span></button>` : ''}<section class="hsc-section"><h3>当前安排</h3>${planMarkup(p)}</section>${job.reminderPrepared && !job.reminderAckAt ? `<section class="hsc-pending hsc-reminder-ready"><strong>${e(job.policy.reminder.text)} · 提醒已备好</strong><p>已到你安排的时间，尚未向${e(job.scenarioId === 'elder' ? personName(job.personId) : '本人')}送达。</p><button class="hsc-confirm-doors" id="hsc-reminder-ack">我已知晓</button></section>` : ''}${job.latestAction ? `<section class="hsc-device-feedback" aria-live="polite"><strong>${e(job.latestAction.title)}</strong><p>${e(job.latestAction.text)}</p></section>` : ''}${insights.markup(prefKey(job.scenarioId, job.personId))}`;
  }
  function renderManagement(job) {
    const host = q('#hsc-management'); if (!host) return;
    const scroll = q('.sheet-body').scrollTop;
    const expanded = new Set([...host.querySelectorAll('details[open][data-insight-id]')].map(item => item.dataset.insightId));
    const referenceOpen = Boolean(host.querySelector('.hsc-reference[open]'));
    host.innerHTML = managementMarkup(job);
    host.querySelector('.hsc-reference').open = referenceOpen;
    host.querySelectorAll('[data-insight-id]').forEach(item => { item.open = expanded.has(item.dataset.insightId); });
    q('.sheet-body').scrollTop = scroll; insights.observe();
    q('#hsc-reminder-ack')?.addEventListener('click', () => { if (!active(job)) return; job.reminderAckAt = now(); update(job, '你已知晓这次提醒', job.policy.reminder.text); emitReminder(job, 'acknowledged'); });
    q('#hsc-change-person')?.addEventListener('click', () => changePerson(job));
    const button = q('#hsc-supplement'); if (button) button.disabled = !active(job) || job.busy;
  }
  function openJob(job) {
    currentPanel = { type: 'manage', job }; proposal = null;
    openSheet(def(job.scenarioId).title, '<div id="hsc-management"></div><div class="dialog-actions hsc-start-actions"><button type="button" class="secondary-button" id="hsc-supplement">补充或纠正</button><button type="button" class="primary-button" id="hsc-end">结束照料</button></div>', { onCancel: closeFlow, restoreFocus: () => entranceFocus(job.scenarioId) });
    frame('home-scenario-manage'); renderManagement(job);
    q('#hsc-supplement').onclick = () => openSupplement(job);
    q('#hsc-end').textContent = job.scenarioId === 'away' ? '结束照看' : job.scenarioId === 'sleep' ? '结束守护' : '结束关怀';
    q('#hsc-end').onclick = () => confirmEnd(job);
  }
  function changePerson(job) {
    openSheet('更换关怀对象', `${personPicker(job.personId)}<p class="sheet-description">本次关怀记录保留，新的安排以你确认的对象为准。</p><div class="dialog-actions"><button class="secondary-button" id="hsc-person-cancel">取消</button><button class="primary-button" id="hsc-person-save" disabled>确认更换</button></div>`, { onCancel: () => openJob(job) }); frame('home-scenario');
    q('#hsc-person').onchange = event => { q('#hsc-person-save').disabled = !event.target.value || event.target.value === job.personId; };
    q('#hsc-person-cancel').onclick = () => openJob(job);
    q('#hsc-person-save').onclick = () => {
      const id = q('#hsc-person').value; if (!active(job) || !people().some(person => person.id === id)) return;
      if (job.reminderEventId && !job.reminderAckAt) emitReminder(job, 'cancelled');
      job.reminderEventId = null; job.reminderPrepared = false; job.reminderAckAt = null;
      job.personId = id; lastPerson = id; job.memoryNotice = null; job.policy = initialPolicy('elder', id); job.endAt = null; job.reminderDue = null; job.revision++;
      update(job, `已改为关怀${personName(id)}`, '按你确认的新对象从基础照料接续，原对象的本次要求不自动套用。'); openJob(job);
    };
  }
  function update(job, title, text) { job.latestTitle = title; job.latestText = text; append(job, title, text); publish(job); }
  function duration(text) {
    const match = text.match(/(\d+)\s*(分钟|小时)/u);
    return /半小时/u.test(text) ? 1800000 : match ? Number(match[1]) * (match[2] === '小时' ? 3600000 : 60000) : null;
  }
  function understand(job, text) {
    const patch = {}, changes = [], commands = [], mentioned = rooms().filter(room => text.includes(room.name));
    if (/可能|好像|不确定|也许/u.test(text)) return { question: '这项安排要只用于本次，还是以后在相同情境都沿用？请再明确一下。' };
    const future = /以后|今后|每次|一直这样|记住|都这样|我习惯|平时|通常/u.test(text) || (/记忆|新理解/u.test(text) && Boolean(sceneMemory(job)));
    if (/别记住|不要记住|不用记住|不要保留.*(?:记忆|新理解)|删除.*记忆|停用.*记忆|忘掉|不再沿用/u.test(text)) {
      const memory = sceneMemory(job);
      return memory ? { patch: {}, commands: [], text, summary: '停用这条场景记忆，后续不再沿用', memoryAction: 'disable' } : { question: '这次还没有整理出新的场景记忆，你可以直接告诉我需要调整的安排。' };
    }
    if (/以后都这样|以后也这样|这条理解没问题|记住这条|确认这条理解/u.test(text) && sceneMemory(job)) {
      const memory = sceneMemory(job), preference = preferences.get(prefKey(job.scenarioId, job.personId));
      return { patch: clone(preference.patch), commands: [], future: true, text, summary: `后续${def(job.scenarioId).title}参考：${memory.text}`, learnedText: memory.text };
    }
    if (job.scenarioId === 'elder') {
      const named = people().find(person => text.includes(person.name));
      if (named && named.id !== job.personId) return { question: job.personId ? `本次正在关怀${personName(job.personId)}。如果要改为${named.name}，请先返回更换关怀对象。` : `请先返回选择${named.name}为关怀对象，再补充所在位置。` };
    }
    const minutes = duration(text);
    if (minutes && (minutes < 60000 || minutes > 86400000)) return { question: '这次需要照料多久？可安排1分钟至24小时，也可以不限定时间。' };
    if (/只(?:照看|关注|照料|留意|守护)|仅(?:照看|关注|照料|留意)/u.test(text)) {
      if (!mentioned.length) return { question: '这次只照料哪个空间？告诉我空间名称即可。' };
      patch.focusIds = mentioned.map(room => room.id); changes.push(`本次重点关注${mentioned.map(room => room.name).join('、')}`);
    } else if (job.scenarioId === 'elder' && mentioned.length && /在|位于/u.test(text)) {
      patch.focusIds = mentioned.map(room => room.id); changes.push(`按你提供的位置，关注${mentioned.map(room => room.name).join('、')}的环境`);
    }
    if (job.scenarioId === 'away' && /(?:优先|先)(?:检查|核对|查看|关注)/u.test(text)) {
      const named = devices().filter(device => text.includes(device.name));
      const targets = named.length ? named : devices().filter(device => mentioned.some(room => room.id === device.roomId) && device.type === 'climate' && /空调/u.test(text));
      if (!targets.length) return { question: '想优先检查哪台设备？告诉我设备名称即可，其他空间仍会继续检查。' };
      patch.priorityDeviceIds = targets.map(device => device.id);
      changes.push(`优先核对${targets.map(device => device.name).join('、')}，其他设备与空间继续检查`);
    }
    if (/(?:不要|不用|不再|取消)保留.*(?:灯|照明)/u.test(text)) {
      patch.keepLights = false; patch.protectIds = []; changes.push('取消固定保留照明的偏好，按当前情况照料');
    } else if (/保留|保持|别关|不要关|不用关|不要动|别动|不调/u.test(text) && /灯|照明/u.test(text)) {
      patch.keepLights = true; patch.protectIds = [...new Set([...job.policy.protectIds, ...mentioned.map(room => room.id)])];
      changes.push(`保留${mentioned.length ? mentioned.map(room => room.name).join('、') : '当前'}照明，不额外调灯`);
    }
    if (/不(?:要|用)?提醒|别提醒|暂停(?:生活)?提醒|少打扰|不要打扰/u.test(text)) { patch.quiet = true; patch.reminder = null; changes.push('本次暂停生活提醒，环境照料继续'); }
    const level = text.match(/(?:调(?:到|至|成)|亮度(?:为|到|设为)?)\s*(\d{1,3})\s*[%％]/u);
    if (level && /灯|照明/u.test(text)) {
      const value = Number(level[1]); if (value < 1 || value > 100) return { question: '灯光亮度需要在1%到100%之间，请再告诉我一次。' };
      let candidates = devices().filter(device => device.type === 'light' && device.permissions?.control && typeof device.level === 'number');
      const named = candidates.filter(device => text.includes(device.name));
      candidates = named.length ? named : candidates.filter(device => mentioned.some(room => device.roomId === room.id));
      if (candidates.length !== 1) return { question: `需要调哪一盏灯？可以说“${(candidates[0] || devices().find(device => device.type === 'light'))?.name || '设备名称'}调到${value}%”。` };
      const device = candidates[0]; if (!device.online) return { question: `${device.name}暂时离线，这次还不能调整。可以先处理连接，或告诉我其他需要。` };
      if (job.policy.keepLights && !/现在|这次|改为|重新/u.test(text)) return { question: `你此前要求保留照明。这次要改为将${device.name}调至${value}%吗？可以补充“这次${device.name}调到${value}%”。` };
      commands.push({ deviceId: device.id, roomId: device.roomId, target: { power: true, level: value }, label: `${device.name}调至${value}%` });
      changes.push(`向${device.name}请求亮度${value}%，等待设备确认`);
    }
    const powerAction = text.match(/关闭|关掉|关上|打开|开启/u)?.[0];
    if (powerAction && !level && !/不要|不用|别|不再|取消/u.test(text)) {
      const named = devices().filter(device => typeof device.power === 'boolean' && text.includes(device.name));
      const candidates = named.length ? named : devices().filter(device => typeof device.power === 'boolean' && mentioned.some(room => room.id === device.roomId) && ((/空调/u.test(text) && device.type === 'climate') || (/(?:灯|照明)/u.test(text) && device.type === 'light')));
      if (candidates.length !== 1) return { question: '这次要操作哪台设备？请说具体设备名称，例如“这次关闭客厅空调”。' };
      const device = candidates[0], power = /打开|开启/u.test(powerAction);
      if (!device.online || !device.permissions?.control) return { question: `${device.name}${!device.online ? '暂时离线' : '没有控制权限'}，这次还不能操作。可先检查连接或调整其他安排。` };
      if (device.type === 'light' && job.policy.keepLights && !/现在|这次|改为|重新/u.test(text)) return { question: `已有保留照明的安排。这次要${power ? '开启' : '关闭'}${device.name}吗？可以补充“这次${power ? '开启' : '关闭'}${device.name}”。` };
      commands.push({ deviceId: device.id, roomId: device.roomId, target: { power }, label: `${power ? '开启' : '关闭'}${device.name}` });
      changes.push(`请求${power ? '开启' : '关闭'}${device.name}，等待设备确认`);
    }
    if (/提醒/u.test(text) && !patch.quiet && !/不(?:要|用)?提醒|别提醒/u.test(text)) {
      if (!minutes) return { question: '希望什么时候提醒、提醒什么？例如“半小时后提醒适当休息”。' };
      const reminderText = text.split(/提醒/u).slice(1).join('提醒').replace(/[。！!]+$/u, '').trim();
      if (!reminderText) return { question: '到时需要提醒什么？再补充一下提醒内容即可。' };
      patch.reminder = { text: reminderText, delayMs: minutes }; patch.quiet = false;
      changes.push(`${minutes / 60000}分钟后在这里准备“${reminderText}”，暂未通知本人`);
    } else if (minutes) { patch.durationMs = minutes; changes.push(`本次照料${minutes / 60000}分钟，到时结束`); }
    if (!changes.length) return { question: '我还需要明确一点：这次想调整哪个空间、用灯或提醒？你也可以直接说出希望保留或改变的安排。' };
    if (future && commands.length) return { question: '这次可以操作设备；长期自动执行还需明确适用条件。请先告诉我这次需要的具体调整。' };
    return { patch, commands, future, text, summary: changes.join('；'), learnedText: `${def(job.scenarioId).title}时，${changes.filter(item => !item.startsWith('向')).join('；').replaceAll('本次', '每次')}` };
  }
  const examples = job => job.scenarioId === 'away' ? ['这次关闭客厅空调', '以后外出优先检查客厅空调', '这次关闭客厅主灯'] : job.scenarioId === 'sleep' ? ['这次保留床头阅读灯', '午休半小时，不要提醒', '以后休息时都不要提醒'] : [`${job.personId ? personName(job.personId) : '家人'}在主卧，午休时不要提醒`, '半小时后提醒喝水', '以后关怀时都不要提醒'];
  const sendIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="url(#hsc-send-gradient)" stroke-width="2" stroke-linecap="round" aria-hidden="true"><defs><linearGradient id="hsc-send-gradient" x1="4" y1="4" x2="20" y2="20"><stop stop-color="#007aff"/><stop offset="1" stop-color="#f96222"/></linearGradient></defs><path d="M12 19V5m-5 5 5-5 5 5"/></svg>';
  function openSupplement(job, back = () => openJob(job)) {
    currentPanel = { type: 'supplement', job }; proposal = null;
    openSheet('告诉小元', `<div class="hsc-conversation"><p class="hsc-context-label">接着${e(def(job.scenarioId).title)}</p><div class="hsc-assistant-message">告诉我哪里需要调整。我会先说清理解，再${isDraft(job) ? '完善待开始的安排' : '更新这次照料'}。</div><div class="hsc-prompt-examples">${examples(job).map(text => `<button data-hsc-example="${e(text)}">${e(text)}</button>`).join('')}</div><div id="hsc-dialogue" aria-live="polite"></div><p class="hsc-voice-caption" id="hsc-voice-caption" hidden>选择一句转成文字，可修改后发送。</p></div><form id="hsc-prompt-form" class="dialog-actions hsc-prompt-footer"><div class="hsc-prompt-shell"><textarea id="hsc-prompt" rows="1" maxlength="300" placeholder="补充或纠正这次照料" aria-label="告诉小元，补充或纠正"></textarea><button type="button" id="hsc-prompt-action" class="hsc-prompt-action" aria-label="语音输入"><img src="assets/voice.svg" alt=""></button></div></form>`, { onCancel: back, restoreFocus: () => entranceFocus(job.scenarioId) });
    // The shared sheet pins direct dialog-actions children, including this form.
    frame('home-scenario-conversation');
    const input = q('#hsc-prompt'), action = q('#hsc-prompt-action');
    const compose = () => { action.innerHTML = input.value.trim() ? sendIcon : '<img src="assets/voice.svg" alt="">'; action.setAttribute('aria-label', input.value.trim() ? '发送补充' : '语音输入'); };
    input.oninput = compose;
    sheet.querySelectorAll('[data-hsc-example]').forEach(button => button.onclick = () => { input.value = button.dataset.hscExample; compose(); input.focus({ preventScroll: true }); });
    action.onclick = () => { if (input.value.trim()) submit(); else { q('#hsc-voice-caption').hidden = false; q('.hsc-prompt-examples').classList.add('is-listening'); toast?.('选择一句，转成文字后发送'); } };
    q('#hsc-prompt-form').onsubmit = event => { event.preventDefault(); submit(); };
    input.onkeydown = event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); submit(); } };
    function submit() {
      if (!editable(job) || job.busy) return;
      const text = input.value.trim(); if (!text) return;
      const understood = understand(job, text); proposal = understood;
      q('#hsc-dialogue').innerHTML = `<div class="hsc-user-message">${e(text)}</div><div class="hsc-assistant-message">${understood.question ? e(understood.question) : `我理解了：${e(understood.summary)}。${understood.future ? `<p>你希望以后也这样。${isDraft(job) ? '开始时会保存为家庭可见的场景偏好。' : '我会在确认后保存为家庭可见的场景偏好。'}</p>` : `<p>${isDraft(job) ? '点击开始后才会执行。' : '先用于本次照料，之后的习惯保持不变。'}</p>`}`}</div>${!understood.question ? `<div class="hsc-proposal"><strong>确认后将更新</strong><p>${e(understood.summary)}</p><div><button class="hsc-text-button" id="hsc-proposal-cancel">先不调整</button><button class="hsc-apply" id="hsc-proposal-apply">${isDraft(job) ? '确认待开始安排' : understood.future ? '确认并记住' : '确认调整'}</button></div><p id="hsc-apply-error" role="alert"></p></div>` : ''}`;
      input.value = ''; compose();
      q('#hsc-proposal-cancel')?.addEventListener('click', back);
      q('#hsc-proposal-apply')?.addEventListener('click', () => apply(job, understood, back));
      schedule(() => { if (currentPanel?.type === 'supplement') q('.sheet-body').scrollTop = q('.sheet-body').scrollHeight; }, 30);
    }
  }
  async function remember(job, intent) {
    const before = sceneMemory(job);
    const old = pref(job.scenarioId, job.personId) || preferences.get(prefKey(job.scenarioId, job.personId)), savedPolicy = clone(intent.patch);
    let result;
    try { result = await onRemember?.({ memoryId: old?.memoryId, text: [...intent.learnedText].slice(0, 80).join(''), subject: job.scenarioId === 'elder' ? personName(job.personId) : '家庭共同安排', roomId: intent.patch.focusIds?.length === 1 ? intent.patch.focusIds[0] : null, context: def(job.scenarioId).title, origin: 'scenario', enabled: true, confirmUnderstanding: true, evidenceText: intent.text }); }
    catch { result = { ok: false, error: '暂时没能保存偏好' }; }
    if (!result?.ok) return { ok: false, error: result?.error || '暂时无法保存偏好，请稍后重试或取消长期选项' };
    preferences.set(prefKey(job.scenarioId, job.personId), { memoryId: result.id || result.item?.id, patch: savedPolicy, text: intent.learnedText, storedText: result.item?.text || [...intent.learnedText].slice(0, 80).join('') });
    const memory = result.item;
    if (!before || insightFingerprint(before) !== insightFingerprint(memory)) insights.note({ key: prefKey(job.scenarioId, job.personId), memory, effect: futureEffect(job.scenarioId, savedPolicy), source: intent.text, kind: /先.+再/u.test(intent.text) ? '照料方式' : /习惯|平时|通常/u.test(intent.text) ? '生活习惯' : '照料偏好', semanticKey: policyKey(savedPolicy), refreshOnly: Boolean(before && policyKey(old?.patch) === policyKey(savedPolicy)) });
    job.memoryNotice = { id: result.id || memory?.id, text: memory?.text || intent.learnedText };
    return { ok: true };
  }
  async function apply(job, intent, back) {
    if (!editable(job) || job.busy || intent !== proposal) return;
    const button = q('#hsc-proposal-apply'); button.disabled = true;
    const save = intent.future === true;
    if (intent.memoryAction) {
      const memory = sceneMemory(job);
      if (isDraft(job)) { job.pendingMemoryDisable = memory.id; job.pendingPreference = null; job.policy = mergePolicy(basePolicy(), job.patch); proposal = null; back(); return; }
      const result = await onRemember?.({ memoryId: memory.id, enabled: false });
      if (!result?.ok) { q('#hsc-apply-error').textContent = result?.error || '暂时无法停用，请稍后重试'; button.disabled = false; return; }
      update(job, '这条记忆已停用', '后续场景不再沿用这项偏好，本次已执行的结果保留。');
      insights.forget(memory.id);
      proposal = null; openJob(job); return;
    }
    if (isDraft(job)) {
      job.patch = mergePolicy(job.patch, intent.patch); job.policy = mergePolicy(job.policy, intent.patch);
      // A draft never emits service records, memory writes or device requests.
      job.commands = [...job.commands.filter(command => !intent.commands.some(next => next.deviceId === command.deviceId)), ...intent.commands];
      if (intent.patch.keepLights) job.commands = [];
      job.supplements.push(intent);
      if (save) job.pendingPreference = intent;
      proposal = null; back(); return;
    }
    if (save) {
      const result = await remember(job, intent);
      if (!result.ok) { if (q('#hsc-apply-error')) q('#hsc-apply-error').textContent = result.error; if (button.isConnected) button.disabled = false; return; }
    }
    if (!active(job)) return;
    job.policy = mergePolicy(job.policy, intent.patch);
    if ('durationMs' in intent.patch) job.endAt = intent.patch.durationMs ? now() + intent.patch.durationMs : null;
    if ('reminder' in intent.patch) { if (job.reminderEventId) { if (!job.reminderAckAt) emitReminder(job, 'cancelled'); job.reminderEventId = null; } job.reminderDue = intent.patch.reminder ? now() + intent.patch.reminder.delayMs : null; job.reminderPrepared = false; job.reminderAckAt = null; }
    if (intent.patch.quiet) { job.reminderDue = null; job.reminderPrepared = false; if (job.reminderEventId && !job.reminderAckAt) emitReminder(job, 'cancelled'); }
    job.revision++; job.snapshotKey = sourceKey(job);
    append(job, '你补充了本次照料', intent.text);
    if (save) {
      append(job, '已整理后续场景偏好', intent.learnedText);
    }
    proposal = null;
    if (!intent.commands.length) { update(job, save ? '已理解并记住，照料安排已更新' : '已按你的补充更新照料', intent.summary); openJob(job); return; }
    runCommands(job, intent.commands, intent.summary); openJob(job);
  }
  function emitDeviceEvent(job, command, id, requestedAt, sourceText, result = null) {
    const device = store.get(command.deviceId), pending = !result;
    const steps = [{ title: '已确认这次调整', detail: command.label, at: requestedAt, state: 'completed' }, { title: pending ? '等待设备反馈' : result.ok ? '设备已确认' : '设备暂未确认', detail: pending ? '请求已发出，以设备反馈为准' : result.message, at: now(), state: pending ? 'running' : result.ok ? 'completed' : 'failed' }];
    onService?.({ id, experienceId: id, kind: 'device-control', careEvent: true, scenarioId: job.scenarioId, scope: 'family', title: pending ? `正在调整${device?.name || '设备'}` : result.ok ? command.label.replace('调至', '已调至').replace(/^关闭(.+)$/u, '$1已关闭').replace(/^开启(.+)$/u, '$1已开启') : `${device?.name || '设备'}暂未确认`, summary: pending ? `${command.label}，正在等待设备反馈` : result.message, status: pending ? '等待设备反馈' : result.ok ? '已完成' : '未确认', state: pending ? 'running' : result.ok ? 'completed' : 'failed', deviceIds: [command.deviceId], controlDeviceIds: pending ? [command.deviceId] : [], image: device?.image, reason: `你在${def(job.scenarioId).title}中确认了这次设备调整。`, evidence: [{ title: '你确认的目标', value: command.label, at: requestedAt }, { title: '本次补充', value: sourceText, at: requestedAt }], steps, next: pending ? '等待设备返回结果' : result.ok ? '可按当前需要继续调整设备' : '可检查设备连接后重新调整', createdAt: requestedAt, updatedAt: now(), at: now() });
    job.latestAction = { title: pending ? '正在等待设备确认' : result.ok ? '设备已确认' : '设备暂未确认', text: pending ? command.label : result.message };
  }
  function emitReminder(job, stage) {
    if (!job.reminderEventId && stage !== 'ready') return;
    if (!job.reminderEventId) { job.reminderEventId = `${job.id}-reminder-${++serial}`; job.reminderEventText = job.policy.reminder.text; job.reminderEventAt = now(); }
    const ready = stage === 'ready', text = job.reminderEventText;
    onService?.({ id: job.reminderEventId, experienceId: job.reminderEventId, kind: 'event', careEvent: true, scope: 'family', title: ready ? `${text}提醒已备好` : stage === 'acknowledged' ? `你已知晓${text}提醒` : `${text}提醒已结束`, summary: ready ? `已到约定时间，站内内容已准备，尚未向${job.scenarioId === 'elder' ? personName(job.personId) : '本人'}送达` : stage === 'acknowledged' ? '已记录你的知晓，未据此判断本人已收到或已完成' : '本次安排已结束，准备过的内容保留，未向本人送达', status: ready ? '待处理' : stage === 'acknowledged' ? '已知晓' : '已结束', state: ready ? 'active' : 'past', evidence: [{ title: '你安排的提醒', value: text, at: job.reminderEventAt }], reason: `你在${def(job.scenarioId).title}中明确安排了这次提醒。`, steps: [{ title: '站内提醒已准备', detail: text, at: job.reminderEventAt }, ...(ready ? [] : [{ title: stage === 'acknowledged' ? '你已知晓' : '安排已结束', detail: '未将站内准备表达为本人已收到', at: now() }])], createdAt: job.reminderEventAt, updatedAt: now(), at: now(), manage: ready && active(job) ? (options = {}) => { returnHandler = options.onReturn || null; openJob(job); } : null });
  }
  async function runCommands(job, commands, summary) {
    if (!active(job)) return;
    job.busy = true; job.state = 'running'; job.pendingIds = commands.map(command => command.deviceId);
    update(job, '正在等待设备确认', summary);
    for (const command of commands) {
      if (!active(job)) break;
      const device = store.get(command.deviceId), eventId = `${job.id}-device-${++serial}`, requestedAt = now();
      emitDeviceEvent(job, command, eventId, requestedAt, summary);
      const step = { title: command.label, detail: '已发出请求，等待设备回应', state: 'running', at: now() }; job.steps.push(step); publish(job);
      let result;
      try { result = device && device.roomId === command.roomId ? await store.requestControl(command.deviceId, command.target) : { ok: false, message: '设备位置已变化，请重新核对' }; }
      catch { result = { ok: false, message: '暂未收到设备反馈' }; }
      emitDeviceEvent(job, command, eventId, requestedAt, summary, result);
      job.actionResults ||= []; job.actionResults.push({ ok: result.ok, label: command.label, message: result.message });
      step.detail = result.message; step.state = result.ok ? 'completed' : 'failed'; step.at = now();
      job.controlledIds = [...new Set([...job.controlledIds, command.deviceId])];
      job.pendingIds = job.pendingIds.filter(id => id !== command.deviceId); job.busy = Boolean(job.pendingIds.length);
      if (active(job)) { job.state = job.busy ? 'running' : 'active'; update(job, result.ok ? '设备已确认，照料继续' : '设备暂未确认，其他照料继续', result.message); }
      else { append(job, '结束后收到设备反馈', result.message); publish(job); }
    }
  }
  function sourceKey(job) {
    const p = snapshot(job.scenarioId, job.policy);
    return JSON.stringify([p.rows.map(row => [row.roomId, row.value, row.source]), p.unavailable.map(device => device.id), p.inUse.map(room => [room.id, room.activity]), job.scenarioId === 'elder' ? people().some(person => person.id === job.personId) : true]);
  }
  function refreshAwayPresence(job) {
    if (job.scenarioId !== 'away' || !active(job)) return;
    const status = presence();
    if (status.key === job.awayPresenceKey) return;
    const changed = status.state !== job.awayPresenceState;
    job.awayPresenceKey = status.key; job.awayPresenceState = status.state;
    if (changed) update(job, '在场信息已更新，继续检查', status.state === 'vacant' ? '现有在场信息已确认无人，继续留意设备、环境及新的活动变化。' : '当前不能按全屋无人执行设备动作；基础检查继续，不将活动反馈直接认定为入侵或家人回家。');
  }
  function refresh() {
    if (destroyed) return;
    for (const job of jobs.values()) {
      if (!active(job) || job.busy) continue;
      refreshAwayPresence(job);
      const key = sourceKey(job);
      if (job.snapshotKey && key !== job.snapshotKey) {
        const before = JSON.parse(job.snapshotKey), p = plan(job.scenarioId, job.policy, job.personId, job);
        const recovered = before[1].filter(id => !p.unavailable.some(device => device.id === id)).map(id => store.get(id)).filter(Boolean).map(deviceLabel);
        const changed = p.rows.filter(row => !before[0].some(old => old[0] === row.roomId && old[1] === row.value && old[2] === row.source));
        job.snapshotKey = key; job.revision++;
        const title = recovered.length ? `${recovered.join('、')}已恢复反馈` : changed.length ? `${changed.map(row => row.title).join('、')}环境信息有更新` : '家庭设备信息有更新';
        update(job, title, `${changed.length ? changed.map(row => `${row.title}${row.value}`).join('；') : '已核对当前设备信息'}。${job.scenarioId === 'away' ? '继续检查设备与环境，结合在场信息判断适合的处理。' : '当前照料继续，家人的使用保持原样。'}`);
      } else job.snapshotKey = key;
    }
    renderEntrances();
    if (currentPanel?.type === 'manage' && sheet.open) renderManagement(currentPanel.job);
    if (currentPanel?.type === 'start' && sheet.open) {
      renderStart(currentPanel.job);
    }
  }
  function advancePreviewSources(job) {
    if (!active(job) || job.demoUsed) return;
    if (job.busy) { schedule(() => advancePreviewSources(job), 2000); return; }
    const p = snapshot(job.scenarioId, job.policy), offline = p.related.find(device => device.type === 'environment' && !device.online);
    job.demoUsed = true;
    if (offline) store.patch(offline.id, { online: true, readings: (offline.readings || []).map(reading => ({ ...reading, updatedAt: now() })) });
    else {
      const row = p.rows.find(item => item.sensorId && Number.isFinite(item.temperature)), device = row && store.get(row.sensorId);
      if (device) store.patch(device.id, { readings: device.readings.map(reading => reading.key === 'temperature' && Number.isFinite(reading.value) ? { ...reading, value: Math.round((reading.value + .5) * 10) / 10, updatedAt: now() } : reading) });
      else update(job, '已核对，暂时没有新的环境反馈', '现有信息仍保留待核对，尚不能据此判断环境结果。');
    }
    if (currentPanel?.type === 'manage' && currentPanel.job === job) renderManagement(job);
  }
  function finish(job, reason) {
    if (!active(job)) return;
    const p = plan(job.scenarioId, job.policy, job.personId, job);
    const actions = (job.actionResults || []).map(result => result.message);
    const outcomes = [actions.length ? actions.join('；') : `已核对${p.readable.length}台设备的可读信息`, job.reminderPrepared ? job.reminderAckAt ? '已知晓安排的提醒' : '安排的站内提醒已备好' : '', p.unavailable.length ? `${p.unavailable.length}项连接仍待核对` : ''].filter(Boolean);
    job.state = 'past'; job.endedAt = now(); job.endReason = reason; job.pendingIds = [];
    update(job, `${def(job.scenarioId).title}已结束`, outcomes.join('；'));
    if (job.reminderEventId && !job.reminderAckAt) emitReminder(job, 'cancelled');
  }
  function confirmEnd(job, reason = 'user') {
    if (!active(job)) return;
    const title = `结束这次${def(job.scenarioId).title}？`;
    openSheet(title, '<p class="sheet-description">本次照料停止后，已发生的设备设置和过程记录保留，其他照料继续。</p><div class="dialog-actions"><button class="secondary-button" id="hsc-end-cancel">继续照料</button><button class="primary-button" id="hsc-end-confirm">确认</button></div>', { variant: 'float', onCancel: () => openJob(job), restoreFocus: () => entranceFocus(job.scenarioId) }); frame('home-scenario-end');
    q('#hsc-end-cancel').onclick = () => openJob(job);
    q('#hsc-end-confirm').onclick = () => { finish(job, reason); returnHandler ? closeFlow() : openStart(job.scenarioId); };
  }
  async function seedInsightExamples() {
    for (const example of scenarioInsightExamples) {
      if (destroyed || (example.personId && !people().some(person => person.id === example.personId))) continue;
      let result;
      try { result = await onRemember?.({ text: example.text, subject: example.personId ? personName(example.personId) : '家庭共同安排', context: def(example.scenarioId).title, roomId: null, origin: 'scenario', evidenceText: example.source }); }
      catch { continue; }
      if (!result?.ok || destroyed) continue;
      preferences.set(prefKey(example.scenarioId, example.personId || ''), { memoryId: result.id, patch: clone(example.patch), text: example.text, storedText: result.item.text });
      insights.note({ key: prefKey(example.scenarioId, example.personId || ''), memory: result.item, effect: example.effect, source: example.source, kind: example.kind, semanticKey: policyKey(example.patch) });
    }
    refresh();
  }
  function renderEntrances() {
    const section = container.querySelector('.hc-modes');
    if (!section.querySelector('[data-home-scenario]')) section.innerHTML = definitions.map(d => `<button type="button" data-home-scenario="${d.id}" class="hsc-entry hsc-tone-${d.tone}"><span class="hsc-entry-icon">${svgFor(d)}</span><span>${d.title}</span><i class="hsc-entry-dot" hidden></i></button>`).join('');
    for (const d of definitions) {
      const button = section.querySelector(`[data-home-scenario="${d.id}"]`), job = jobs.get(d.id);
      button.dataset.current = String(active(job)); button.querySelector('i').hidden = !active(job);
      button.setAttribute('aria-label', `${d.title}，${active(job) ? '查看当前照料' : '查看小元的基础照料安排'}`);
    }
    const all = [...jobs.values()].filter(active), tag = container.querySelector('.hc-current-mode');
    tag.hidden = !all.length; tag.dataset.scenarioCount = all.length;
    if (all.length) { tag.innerHTML = `<span class="hsc-tag-dot"></span><span>${all.length === 1 ? def(all[0].scenarioId).title : `${all.length}项照料进行中`}</span>`; tag.setAttribute('aria-label', `查看${all.length}项正在进行的照料`); }
  }
  function openActiveList() {
    const all = [...jobs.values()].filter(active); if (!all.length) return;
    returnHandler = null;
    if (all.length === 1) { openJob(all[0]); return; }
    currentPanel = null;
    openSheet('正在进行的照料', `<p class="sheet-description">小元分别接续每一件事，你可以随时补充或结束。</p><div class="hsc-active-list">${all.map(job => { const d = def(job.scenarioId); return `<button data-hsc-active="${d.id}" class="hsc-tone-${d.tone}"><span class="hsc-list-icon">${svgFor(d)}</span><span><strong>${d.title}</strong><small>${job.scenarioId === 'elder' ? e(personName(job.personId)) : '家庭基础照料'}</small><small>${e(job.latestTitle)}</small></span><span class="hsc-list-arrow">›</span></button>`; }).join('')}</div>`, { onCancel: closeFlow }); frame('home-scenario');
    sheet.querySelectorAll('[data-hsc-active]').forEach(button => button.onclick = () => openJob(jobs.get(button.dataset.hscActive)));
  }
  function open(id) { if (!def(id) || destroyed) return; returnHandler = null; active(jobs.get(id)) ? openJob(jobs.get(id)) : openStart(id); }
  function click(event) { const button = event.target.closest('[data-home-scenario]'); if (button) open(button.dataset.homeScenario); else if (event.target.closest('.hc-current-mode')) openActiveList(); }
  const unsubscribe = store.subscribe(refresh);
  const tick = setInterval(() => {
    for (const job of jobs.values()) {
      if (!active(job)) continue;
      refreshAwayPresence(job);
      if (job.endAt && now() >= job.endAt) { finish(job, 'expiry'); continue; }
      if (job.scenarioId === 'elder' && !people().some(person => person.id === job.personId)) continue;
      if (job.reminderDue && now() >= job.reminderDue && !job.reminderPrepared && !job.policy.quiet) {
        job.reminderPrepared = true; update(job, '你安排的提醒已在这里备好', `${job.policy.reminder.text}。提醒内容已准备好，尚未向本人送达。`); emitReminder(job, 'ready');
      }
    }
  }, 1000);
  container.addEventListener('click', click); renderEntrances(); seedInsightExamples();
  return { refresh, open, get(id) { const job = jobs.get(id) || [...jobs.values()].find(item => item.id === id); return job && serviceData(job); }, getActive() { return [...jobs.values()].filter(active).map(serviceData); }, destroy() { destroyed = true; insights.destroy(); unsubscribe(); clearInterval(tick); timers.forEach(clearTimeout); container.removeEventListener('click', click); } };
}
