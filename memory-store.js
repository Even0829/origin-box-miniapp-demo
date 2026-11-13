// 同源本地记忆；持久化由对话模块协调，适用范围不等同于执行许可。
const TYPES = new Set(['short', 'long']);
const VISIBILITIES = new Set(['personal', 'family']);
const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
const clone = (value) => value == null ? value : structuredClone(value);
const textOf = (value) => String(value ?? '').trim();
const lengthOf = (value) => [...value].length;

function dateAt(stamp) {
  const parts = Object.fromEntries(formatter.formatToParts(stamp).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function formatDate(value) {
  const [year, month, day] = value.split('-');
  return `${year}.${month}.${day}`;
}

export function createMemoryStore({ seedMode = 'normal', getMemberId = null, initialRecords = null, personalSeeds = [], getRooms = () => [], now = () => Date.now(), onRecord = () => {} } = {}) {
  const stamp = () => Number(now());
  const today = () => dateAt(stamp());
  const listeners = new Set();
  const memories = [];
  let sequence = 0;
  let transaction = null;
  const rooms = () => getRooms() || [];
  const visible = item => !getMemberId || Boolean(getMemberId()) && (item.visibility === 'family' || item.ownerId === getMemberId());
  const find = (id) => memories.find((item) => item.id === id && visible(item));
  const knownRoom = (id) => rooms().some((room) => room.id === id);
  const roomName = (id) => id === null ? '' : rooms().find((room) => room.id === id)?.name || '原空间已移除';
  const scopeText = (item) => [item.visibility === 'family' ? '家庭共享' : '仅自己', item.subject, item.roomId === null ? '' : roomName(item.roomId), item.context].filter(Boolean).join(' · ');

  function snapshot(item) {
    if (!item) return null;
    const expired = item.type === 'short' && isDate(item.expiresAt) && today() > item.expiresAt;
    return clone({
      ...item,
      evidence:(item.evidence || []).filter(entry=>!getMemberId || !entry.privateOwnerId || entry.privateOwnerId===getMemberId()),
      previous:(item.previous || []).filter(entry=>!getMemberId || !entry.privateOwnerId || entry.privateOwnerId===getMemberId()),
      expired,
      roomName: roomName(item.roomId),
      scopeText: scopeText(item),
      periodText: item.type === 'long' ? '持续适用' : `${expired ? '已于' : '适用至'} ${formatDate(item.expiresAt)}${expired ? ' 到期' : ''}`,
    });
  }

  const fail = (error, field) => ({ ok: false, error, ...(field ? { field } : {}) });

  function normalize(draft, original = null) {
    if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return fail('请输入记忆内容', 'text');
    if (original && 'visibility' in draft && draft.visibility !== original.visibility) return fail('记忆的可见范围暂不支持修改', 'visibility');
    const value = (key, fallback) => key in draft ? draft[key] : original ? original[key] : fallback;
    const text = textOf(value('text', ''));
    const type = value('type', 'long');
    const visibility = original?.visibility || value('visibility', 'personal');
    const context = textOf(value('context', ''));
    const subject = textOf(value('subject', visibility === 'family' ? '家庭共同安排' : '你'));
    const roomId = value('roomId', null);
    const expiresAt = type === 'long' ? null : value('expiresAt', null);
    if (!text || lengthOf(text) > 80) return fail('记忆内容需要1至80个字', 'text');
    if (!TYPES.has(type)) return fail('请选择短期或长期记忆', 'type');
    if (!VISIBILITIES.has(visibility)) return fail('请选择记忆的可见范围', 'visibility');
    if (lengthOf(context) > 40) return fail('适用情境最多40个字', 'context');
    if (lengthOf(subject) > 20) return fail('适用主体最多20个字', 'subject');
    // 已存在但被删除的空间可原样保留；不得悄悄绑定到同名或其他空间。
    if (roomId !== null && !knownRoom(roomId) && (!original || roomId !== original.roomId)) return fail('这个空间已不存在，请重新选择', 'roomId');
    if (type === 'short' && !isDate(expiresAt)) return fail('请设置有效的适用日期', 'expiresAt');
    if (type === 'short' && expiresAt < today() && (!original || expiresAt !== original.expiresAt || type !== original.type)) return fail('适用日期不能早于今天', 'expiresAt');
    const defaultPeriodNote = type === 'short' ? '到期后不再作为当前协助的依据' : '持续适用，可随时调整';
    const periodNote = textOf('periodNote' in draft ? draft.periodNote : original && original.type === type ? original.periodNote : defaultPeriodNote);
    return { ok: true, value: { text, type, visibility, context, subject: subject || (visibility === 'family' ? '家庭共同安排' : '你'), roomId, expiresAt, periodNote } };
  }

  function changed(type, item, label, description) {
    item.revision = (item.revision || 0) + 1;
    const event = { type, id: item.id, item: snapshot(item) };
    const notify = () => {
      onRecord({ scope: item.visibility, label, text: description });
      for (const listener of listeners) listener(clone(event));
    };
    if (transaction) transaction.push(notify); else notify();
    return { ok: true, id: item.id, item: snapshot(item) };
  }

  function create(draft) {
    if(getMemberId&&!getMemberId())return fail('请先加入家庭');
    const normalized = normalize(draft);
    if (!normalized.ok) return normalized;
    const at = stamp();
    const value = normalized.value;
    const item = {
      id: `memory-${at}-${++sequence}-${crypto.randomUUID().slice(0,8)}`,
      ...value,
      ...(getMemberId ? {ownerId:getMemberId()} : {}),
      understanding: draft.origin === 'scenario' && draft.understanding === 'checking' ? 'checking' : 'clear',
      enabled: typeof draft.enabled === 'boolean' ? draft.enabled : true,
      sourceLabel: draft.origin === 'scenario' ? '从照料中整理' : '你告诉我的',
      sourceDetail: draft.origin === 'scenario' ? '小元从有来源的场景补充中整理，推测的理解核对后再沿用' : '你在记忆中主动补充了这条内容',
      evidence: [{ title: draft.origin === 'scenario' ? '场景照料中的补充' : '你补充的内容', text: textOf(draft.evidenceText) || value.text, at, ...(draft.privateEvidence && getMemberId ? {privateOwnerId:getMemberId()} : {}) }],
      help: value.visibility === 'family' ? '在相关家庭情境中理解共同安排，具体操作仍需遵循权限与指令' : '在与你相关的交流和任务中参考这条信息，保持仅自己可见的范围',
      previous: [],
      createdAt: at,
      updatedAt: at,
    };
    memories.push(item);
    return changed('created', item, '新增记忆', `新增记忆：${item.text}`);
  }

  function update(id, draft) {
    const item = find(id);
    if (!item) return fail('这条记忆已不存在');
    const normalized = normalize(draft, item);
    if (!normalized.ok) return normalized;
    const value = normalized.value;
    const keys = Object.keys(value);
    const confirmation = draft.confirmUnderstanding === true && ['checking', 'update'].includes(item.understanding);
    if (!confirmation && keys.every((key) => value[key] === item[key])) return { ok: true, id, item: snapshot(item) };
    const correction = value.text !== item.text || value.context !== item.context;
    const at = stamp();
    if (correction) {
      item.previous.unshift({ text: item.text, scopeText: scopeText(item), at: item.updatedAt });
      item.understanding = 'clear';
      item.sourceLabel = '你修正';
      item.sourceDetail = '你修正了记忆内容或适用情境';
      item.evidence.unshift({ title: '你的修正', text: textOf(draft.evidenceText) || (value.context ? `${value.text}（适用情境：${value.context}）` : value.text), at, ...(draft.privateEvidence && getMemberId ? {privateOwnerId:getMemberId()} : {}) });
    } else if (confirmation) {
      item.understanding = 'clear';
      item.sourceLabel = '你确认';
      item.sourceDetail = '你确认这条记忆的内容与适用情境仍然正确';
      item.evidence.unshift({ title: '你的确认', text: value.context ? `${value.text}（适用情境：${value.context}）` : value.text, at });
    }
    if (correction || confirmation) item.help = value.visibility === 'family' ? `在${value.context || '相关家庭情境'}中参考这条信息，具体操作仍需遵循权限与指令` : `在${value.context || '与你相关的交流和任务'}中参考这条信息，保持仅自己可见的范围`;
    Object.assign(item, value, { updatedAt: at });
    // 修改期限或内容不会恢复停用状态；原样核对仅在用户明确确认时成立。
    const action = correction ? '修正' : confirmation ? '确认' : '调整';
    return changed('updated', item, `${action}记忆`, `${action}记忆：${item.text}`);
  }

  function setEnabled(id, enabled) {
    const item = find(id);
    if (!item) return fail('这条记忆已不存在');
    if (typeof enabled !== 'boolean') return fail('请选择启用或停用', 'enabled');
    if (enabled && snapshot(item).expired) return fail('请先调整适用日期', 'expiresAt');
    if (item.enabled === enabled) return { ok: true, id, item: snapshot(item) };
    item.enabled = enabled;
    item.updatedAt = stamp();
    return changed('enabled', item, enabled ? '启用记忆' : '停用记忆', `${enabled ? '启用' : '停用'}记忆：${item.text}`);
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function seed() {
    const at = stamp();
    const day = (offset) => dateAt(new Date(`${today()}T00:00:00+08:00`).getTime() + offset * 86400000);
    const seedRoom = (id) => knownRoom(id) ? id : null;
    const items = [
      { id: 'memory-work-brief', text: '这周的项目汇报，先给我一页结论，再附详细数据', type: 'short', understanding: 'clear', visibility: 'personal', subject: '你', context: '本周项目汇报', expiresAt: day(7), help: '整理本周汇报时优先呈现结论，再提供数据依据', sourceLabel: '你告诉我的', evidenceText: '汇报先控制在一页，详细数据放在后面' },
      { id: 'memory-living-light', text: '客厅有人休息时，灯光以柔和为主', type: 'long', understanding: 'clear', visibility: 'family', subject: '家庭空间', roomId: seedRoom('living'), context: '客厅休息时', help: '理解客厅休息时的灯光偏好，实际调节仍需满足设备能力与操作许可', sourceLabel: '你告诉我的', evidenceText: '有人在客厅休息时，灯光柔和一点就好' },
      { id: 'memory-morning-focus', text: '工作日早上，先整理当天最重要的三件事', type: 'long', understanding: 'checking', visibility: 'personal', subject: '你', context: '工作日早间安排', help: '供你核对是否适合作为早间任务整理偏好，核对前保留不确定性', sourceLabel: '从交流中整理', evidenceText: '最近几次早间交流，你先询问了当天的重点安排' },
      { id: 'memory-master-routine', text: '主卧通常在23:00后调暗灯光', type: 'long', understanding: 'update', visibility: 'family', subject: '家庭空间', roomId: seedRoom('master'), context: '晚间休息', help: '提醒此前的作息信息可能需要更新，不能据此继续沿用旧时间', sourceLabel: '此前的安排', evidenceText: '此前约定23:00后准备休息，近期你提到作息有所变化', previous: [{ text: '主卧在22:30后准备休息', scopeText: '家庭共享 · 家庭空间 · 晚间休息', at: at - 12 * 86400000 }] },
      { id: 'memory-weekend-travel', text: '这次周末出行，优先比较高铁方案', type: 'short', understanding: 'clear', enabled: false, visibility: 'personal', subject: '你', context: '周末出行规划', expiresAt: day(10), help: '启用后用于比较本次出行方案，停用期间不再参考这项偏好', sourceLabel: '你告诉我的', evidenceText: '这次先看高铁，方便控制路上的时间' },
      { id: 'memory-family-meeting', text: '这几天下午家里有人远程开会，尽量保持安静', type: 'short', understanding: 'clear', visibility: 'family', subject: '家庭共同安排', context: '下午远程会议', expiresAt: day(-2), help: '在适用期间理解家中的临时会议安排，协助减少不必要的打扰', sourceLabel: '你告诉我的', evidenceText: '这几天下午有线上会议，家里尽量安静一些' },
      { id: 'memory-research-style', text: '整理资料时保留来源链接，把事实和建议分开', type: 'long', understanding: 'clear', visibility: 'personal', subject: '你', context: '资料整理与工作研究', help: '组织工作材料时保留查证路径，帮助你区分信息依据与行动建议', sourceLabel: '你告诉我的', evidenceText: '资料要能查到来源，建议单独列出来' },
      { id: 'memory-dinner-light', text: '准备晚餐时，厨房和餐厅的照明可以一起考虑', type: 'long', understanding: 'checking', enabled: false, visibility: 'family', subject: '家庭空间', roomId: seedRoom('kitchen'), context: '晚餐准备', help: '保留待核对的晚餐照明想法；停用期间不作为设备协同的依据', sourceLabel: '从交流中整理', evidenceText: '你曾在准备晚餐时一起提到厨房和餐厅的灯光' },
    ];
    items.filter(item=>seedMode!=='family'||item.visibility==='family').forEach((item, index) => {
      const updatedAt = at - (index + 1) * 3 * 60 * 60 * 1000;
      memories.push({
        roomId: null,
        enabled: true,
        expiresAt: null,
        previous: [],
        ...item,
        periodNote: item.type === 'short' ? '到期后不再作为当前协助的依据' : '持续适用，可随时调整',
        sourceDetail: item.sourceLabel === '你告诉我的' ? '来自你此前主动说明的安排或偏好' : item.understanding === 'update' ? '来自此前的作息安排，近期信息提示需要更新' : '从相关交流中整理出的暂定理解，等待你核对',
        evidence: [{ title: item.sourceLabel === '你告诉我的' ? '你此前说过' : '相关交流', text: item.evidenceText, at: updatedAt }],
        createdAt: (item.previous?.length ? Math.min(...item.previous.map((entry) => entry.at)) : updatedAt) - 2 * 86400000,
        updatedAt,
      });
      delete memories.at(-1).evidenceText;
    });
  }

  if(initialRecords)memories.push(...clone(initialRecords));
  else {
    if(seedMode!=='empty')seed();
    if(getMemberId)memories.forEach(item=>{if(item.visibility==='personal')item.ownerId=getMemberId();});
    for(const item of personalSeeds)memories.push({type:'long',visibility:'personal',enabled:true,understanding:'clear',roomId:null,subject:'你',context:'日常交流',expiresAt:null,periodNote:'持续适用，可随时调整',sourceLabel:'从盒子交流中记住',sourceDetail:'来自本地预置的成员交流样例',evidence:[{title:'此前与小元的交流',text:item.text,at:stamp()-86400000}],help:'在与本人交流时参考，个人内容仅本人可见',previous:[],createdAt:stamp()-86400000,updatedAt:stamp()-3600000,...item});
  }
  return {
    reclassify(id, visibility) {
      const item=find(id);
      if(!item || !getMemberId || item.ownerId!==getMemberId())return fail('家庭现有约定会保留，可以为你单独记下一条偏好');
      if(!VISIBILITIES.has(visibility))return fail('无法识别记忆归属');
      if(item.visibility===visibility)return {ok:true,id,item:snapshot(item)};
      if(item.visibility==='personal') {
        for(const entry of [...item.evidence,...item.previous])entry.privateOwnerId ||= item.ownerId;
      }
      item.visibility=visibility;
      item.subject=visibility==='family'?'家庭共同安排':'你';
      item.sourceLabel='从交流中整理';
      item.sourceDetail='根据明确的适用对象整理，相关私人交流仅本人可见';
      item.help=visibility==='family'?'作为家庭共同安排的参考，实际操作仍遵循权限与指令':'仅在与你相关的交流和安排中参考';
      item.updatedAt=stamp();
      item.evidence.unshift({title:'记忆归属已调整',text:visibility==='family'?'已记为家庭共同约定':'已记为个人记忆，仅本人可见',at:item.updatedAt});
      return changed('reclassified',item,'调整记忆归属',visibility==='family'?`已记为家庭共同约定：${item.text}`:'一条记忆已调整为个人记忆');
    },
    // Persist the memory and its conversation together before publishing any effects.
    batch(action, persist) {
      if (transaction) throw new Error('Nested memory transaction');
      const before = clone(memories), oldSequence = sequence;
      transaction = [];
      let result, notices;
      try {
        result = action();
        if (!result?.ok) { memories.splice(0, memories.length, ...before); sequence = oldSequence; transaction = null; return result; }
        persist(); notices = transaction; transaction = null;
      } catch (error) { memories.splice(0, memories.length, ...before); sequence = oldSequence; transaction = null; throw error; }
      notices.forEach(notify => notify());
      return result;
    },
    restore(id, previous, expectedRevision) {
      const item = find(id);
      if (!item || (item.revision || 0) !== expectedRevision) return fail('这条记忆有了新的调整，不能撤销旧版本，请直接说明要如何修改');
      if (previous.ownerId !== item.ownerId || previous.visibility !== item.visibility && (!getMemberId || item.ownerId !== getMemberId())) return fail('无法改变记忆归属');
      const beforeText = item.text, wasPrivate = item.visibility==='personal';
      if(item.visibility==='personal'&&previous.visibility==='family')for(const entry of [...item.evidence,...item.previous])entry.privateOwnerId ||= item.ownerId;
      for (const key of ['text','type','context','subject','roomId','expiresAt','periodNote','enabled','understanding','help','visibility']) item[key] = clone(previous[key]);
      item.previous.unshift({text:beforeText,scopeText:scopeText(item),at:stamp(),...(wasPrivate ? {privateOwnerId:item.ownerId} : {})});
      item.evidence.unshift({title:'撤销本次更新',text:`恢复为：${item.text}`,at:stamp()});
      item.updatedAt = stamp();
      return changed('restored', item, '撤销记忆更新', `已撤销本次更新：${item.text}`);
    },
    dumpForReview: () => clone(memories),
    syncForReview(records){if(!Array.isArray(records))return;memories.splice(0,memories.length,...clone(records));listeners.forEach(fn=>fn({kind:'review-sync'}));},
    getMemories: () => memories.filter(visible).map(snapshot).sort((a, b) => b.updatedAt - a.updatedAt),
    get: (id) => snapshot(find(id)),
    create,
    update,
    setEnabled,
    subscribe,
    today,
  };
}
