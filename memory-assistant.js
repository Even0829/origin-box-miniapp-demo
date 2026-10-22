const clean = (value) => String(value ?? '').trim().replace(/[。！!？?]+$/u, '').trim();
const count = (value) => [...value].length;
const stateLabel = (item) => !item.enabled ? '已停用' : item.expired ? '已到期' : '使用中';
const periodLabel = (item) => item.type === 'long' ? '持续适用' : `适用至 ${item.expiresAt}`;
const fail = (message) => ({ ok: false, message });

export function resolveDate(value, today) {
  const text = clean(value).replace(/(?:当天|为止)$/u, '');
  const base = new Date(`${today}T12:00:00Z`);
  if (!Number.isFinite(base.getTime())) return null;
  const iso = (date) => date.toISOString().slice(0, 10);
  const add = (days) => { const date = new Date(base); date.setUTCDate(date.getUTCDate() + days); return iso(date); };
  if (text === '今天') return today;
  if (text === '明天') return add(1);
  if (text === '后天') return add(2);
  const weekday = (base.getUTCDay() + 6) % 7;
  if (/^(?:本周日|这周日|本周天|这周天|本周末)$/u.test(text)) return add(6 - weekday);
  if (text === '下周五') return add(11 - weekday);
  let match = text.match(/^(\d{4})[年/.-](\d{1,2})[月/.-](\d{1,2})日?$/u);
  if (!match) { const short = text.match(/^(\d{1,2})月(\d{1,2})日?$/u); if (short) match = [short[0], today.slice(0, 4), short[1], short[2]]; }
  if (!match) return null;
  const date = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && iso(parsed) === date ? date : null;
}

// Deliberately bounded local interpretation. Unknown instructions never become memory content.
export function parseMemoryInstruction(instruction, item, { today, rooms = [] } = {}) {
  let text = clean(instruction);
  if (!item) return fail('这条记忆已不可用，请返回记忆列表');
  text = naturalMemoryInstruction(text, item);
  if (!text) return fail('先说说你想怎么调整，也可以在上方输入文字');
  if (count(text) > 300) return fail('这次先说一件事，控制在300字以内');
  if (/(?:彻底删除|删除|忘掉|忘记|清空)/u.test(text)) return fail('这里可以让小元不再使用这条记忆。可以说“先别用这条记忆”，过往记录仍会保留');
  if (/(?:可见范围|共享范围|分享给|公开给|改[成为].*(?:家庭共享|全家可见|仅自己|所有人|私人)|转为家庭|转成家庭)/u.test(text)) return fail('这条记忆会保持原来的可见范围。请只说明内容、适用时间、空间或是否继续使用');
  if (/(?:不要|不用|别)(?:恢复|启用|停用)|不恢复/u.test(text)) return fail('我还不能确定你要保留哪种使用状态。请明确说“恢复使用”或“先别用这条记忆”');
  const clauses = text.replace(/(?:并且|并|同时|然后)(?=(?:恢复|重新启用|重新使用|不再使用|停用|延期|延长|把适用|将适用))/gu, '；')
    .split(/[；;\n]+|[，,](?=\s*(?:并且|并|同时|然后|再)?(?:恢复|重新启用|重新使用|停用|不再使用|先别用|暂停|将适用|把适用|适用|延期|延长|改成长期|改为长期|空间))/u)
    .map((part) => clean(part).replace(/^[，,\s]+|[，,\s]+$/gu, '').replace(/^(?:请|麻烦|帮我|小元[，,]?|并且|并|同时|然后)\s*/u, '').replace(/(?:一下|就好|即可|吧)$/u, '').trim()).filter(Boolean);
  const patch = {};
  let enabled;
  let confirmation = false;
  for (const clause of clauses) {
    if (/^(?:(?:把|将)?(?:这条记忆|这条理解|它))?(?:先)?(?:停用|暂停使用|不再使用|不再参考|先别用|别再用|别用)(?:这条记忆|这条理解|这条|它)?$/u.test(clause)) {
      if (enabled === true) return fail('同时听到了恢复和停用，请说明这条记忆接下来是否继续使用');
      enabled = false; continue;
    }
    if (/^(?:(?:把|将)?(?:这条记忆|这条理解|它))?(?:恢复使用|恢复|重新启用|重新使用|启用)(?:这条记忆|这条理解|这条|它)?$/u.test(clause)) {
      if (enabled === false) return fail('同时听到了恢复和停用，请说明这条记忆接下来是否继续使用');
      enabled = true; continue;
    }
    if (/^(?:就是这样(?:[，,]?(?:记住|记住吧|记住就好))?|没错|理解没问题|理解正确|这条理解是对的|这条是对的|确认理解|确认这条理解|保持原样)$/u.test(clause)) { confirmation = true; continue; }
    if (/^(?:(?:把|将)?(?:这条记忆|适用时效|适用时间|期限)(?:的适用时效)?)?(?:改成|改为|设为|调整为|变为)?(?:长期|长期适用|持续适用)$/u.test(clause)) {
      if (patch.type === 'short') return fail('同时听到了持续适用和截止日期，请选择其中一种');
      patch.type = 'long'; patch.expiresAt = null; continue;
    }
    const room = clause.match(/^(?:(?:把|将)?(?:这条记忆的)?(?:适用)?空间(?:改为|改成|改到|调整为|调整到|设为|移到|：|:)?|只适用(?:于|在))[：:]?\s*(.+)$/u);
    if (room) {
      const name = clean(room[1]).replace(/^[：:]\s*/u, '');
      if (/^(?:不限定空间|不限空间|所有空间)$/u.test(name)) patch.roomId = null;
      else { const target = rooms.find((entry) => entry.name === name); if (!target) return fail(`没有找到“${name}”这个空间，请使用家中已有的空间名称`); patch.roomId = target.id; }
      continue;
    }
    const time = clause.match(/^(?:(?:把|将)?(?:这条记忆的)?(?:适用时间|适用期限|适用时效|有效期|期限|时间))?(?:改到|改为|改成|延长到|延长至|延期到|延期至|延到|延至|适用到|适用至|调整到|调整为)[：:]?\s*(.+)$/u);
    if (time && (resolveDate(time[1], today) || /(?:今天|明天|后天|周|\d.*(?:月|日|-|\/)|短期|期限|适用)/u.test(time[1]))) {
      const date = resolveDate(time[1], today);
      if (!date) return fail('请告诉我具体适用到哪天，例如“延到下周五”或“适用到2026年11月8日”');
      if (date < today) return fail('这个日期已经过去了，请告诉我今天或之后的适用日期');
      if (patch.type === 'long') return fail('同时听到了持续适用和截止日期，请选择其中一种');
      patch.type = 'short'; patch.expiresAt = date; continue;
    }
    const correction = clause.match(/^(?:(?:把|将)?(?:这条记忆|这条理解|它)(?:的内容)?)?(?:改成|改为|修改为|纠正为|更新为)[：:]?\s*(.+)$/u);
    if (correction) {
      const content = clean(correction[1]).replace(/^[“"「『](.*)[”"」』]$/u, '$1');
      if (!content || count(content) > 80) return fail('新的记忆内容需要1至80字，可以简短说清一件事');
      if (/^(?:短期|长期|更久|晚一点|早一点|更准确|新的情况|这样|那个|对的|不对)/u.test(content)) return fail('再具体说说新的情况。例如“把这条记忆改为：主卧在23:30后调暗灯光”');
      if (patch.text && patch.text !== content) return fail('听到了两个不同的新内容，请保留你最终想记住的那一个');
      patch.text = content; continue;
    }
    return fail('你想把这条记忆改成什么？也可以告诉我新的适用时间，或是否继续使用');
  }
  if (patch.type === 'long') patch.expiresAt = null;
  if (confirmation && item.understanding !== 'clear') patch.confirmUnderstanding = true;
  const next = { ...item, ...patch, enabled: enabled ?? item.enabled };
  next.expired = next.type === 'short' && next.expiresAt < today;
  if (enabled === true && next.expired) return fail('这条记忆已到期，请同时告诉我新的日期，例如“延到下周五，并恢复使用”');
  if (Object.keys(patch).length && next.expired) return fail('这条记忆已到期，调整内容时也需要告诉我新的适用日期');
  const roomLabel = (id) => id == null ? '不限定空间' : rooms.find((entry) => entry.id === id)?.name || '原空间已移除';
  const changes = [];
  if (patch.text && patch.text !== item.text) changes.push({ label: '记忆内容', before: item.text, after: patch.text });
  if (patch.roomId !== undefined && patch.roomId !== item.roomId) changes.push({ label: '适用空间', before: roomLabel(item.roomId), after: roomLabel(next.roomId) });
  if ((patch.type && patch.type !== item.type) || (patch.expiresAt !== undefined && patch.expiresAt !== item.expiresAt)) changes.push({ label: '适用时间', before: periodLabel(item), after: periodLabel(next) });
  if (enabled !== undefined && enabled !== item.enabled) changes.push({ label: '使用状态', before: stateLabel(item), after: stateLabel(next) });
  if (patch.confirmUnderstanding) changes.push({ label: '理解状态', before: item.understanding === 'checking' ? '待核对' : '需要更新', after: '已明确' });
  if (!changes.length) return fail('这条记忆目前就是这个状态，无需重复修改。你也可以继续说明新的情况');
  return { ok: true, patch, enabled, next, changes, summary: changes.map((change) => change.label).join('、') };
}

const memoryCopy = {
  'memory-work-brief': ['以后先给我三条结论，再附详细数据', '把这条记忆改为：项目汇报先给三条结论，再附详细数据'],
  'memory-living-light': ['有人休息的时候，客厅灯光再柔和一点', '把这条记忆改为：客厅有人休息时，灯光柔和并调暗一些'],
  'memory-master-routine': ['以后晚上十一点半再调暗灯光', '把这条记忆改为：主卧在23:30后调暗灯光'],
  'memory-research-style': ['以后整理资料，结论和建议分开写', '把这条记忆改为：整理资料时保留来源，结论和建议分别列出'],
};

function naturalMemoryInstruction(text, item) {
  const copy = memoryCopy[item.id];
  if (copy && text === copy[0]) return copy[1];
  const common = {
    '这条理解没问题，就按这个来': '这条理解是对的',
    '这条记忆先保留到下周五': '把适用时间延到下周五',
    '先用到下周五': '把适用时间延到下周五',
    '以后都按这个来': '把适用时效改为长期',
    '这条先别用了': '先别用这条记忆',
    '这条重新用起来': '恢复使用这条记忆',
    '再用到下周五，并恢复使用': '把适用时间延到下周五，并恢复使用',
  };
  return common[text] || text;
}

export function memoryCorrectionSamples(item) {
  const first = item.understanding !== 'clear' && item.id !== 'memory-master-routine' ? '这条理解没问题，就按这个来' : memoryCopy[item.id]?.[0] || '这条记忆先保留到下周五';
  return [first, item.type === 'short' ? '以后都按这个来' : '先用到下周五', item.enabled ? '这条先别用了' : item.expired ? '再用到下周五，并恢复使用' : '这条重新用起来'];
}
