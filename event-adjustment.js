import { previewNow } from './preview-clock.js';

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const baseline = device => ({ id: device.id, roomId: device.roomId, revision: device.controlRevision || 0 });
const cancelText = text => /^(?:算了|取消|取消修改|不用改了|先不改|保持原样)[。！!\s]*$/u.test(text);
const confirmText = text => /^(?:确认|确认修改|确认调整|可以|就这样|好的|好|没问题|确认，就这样)[。！!\s]*$/u.test(text);
const lightWords = /灯|照明|亮度/u;
const airWords = /净化|空气置地机/u;

// Finite local intent examples. A proposal never sends a device request.
export function planEventCorrection(text, item, devices, getControls = () => []) {
  const linked = (item.deviceIds || []).map(id => devices.find(device => device.id === id)).filter(Boolean);
  const commands = new Map(), held = new Set();
  const clauses = text.split(/[，,。；;！!？?\n]+/u).map(value => value.trim()).filter(Boolean);
  let correction = '', understood = false;
  for (const clause of clauses) {
    if (/以后|今后|下次|每次|一直|长期|每天/u.test(clause)) return { reply: '这里先处理这一次。你希望这次具体怎么调整？' };
    if (correction && /^(?:是|而是|我在|是在|现在|我们在)/u.test(clause) && /看电视|观影|聊天|阅读|休息|吃饭/u.test(clause)) { correction += `；${clause}`; continue; }
    if (/不是|理解错|搞错|纠正|实际|其实|并没有/u.test(clause) && /看电视|观影|聊天|阅读|休息|吃饭|理解|判断/u.test(clause) && !/调亮|调暗|亮度|模式/u.test(clause)) {
      correction = [correction, clause].filter(Boolean).join('；'); understood = true; continue;
    }
    if (/不是|并非|并不/u.test(clause)) return { reply: '请直接说明最终希望的设置，例如“灯光保持现在这样，净化关闭”。我会再和你确认。' };
    const named = linked.filter(device => device.name && clause.includes(device.name));
    let targets = named.length ? named : linked.filter(device => device.type === 'light' && lightWords.test(clause) || device.type === 'air' && airWords.test(clause));
    if (!targets.length) return { reply: '可以具体说一下哪项需要修改吗？例如“灯光调到50%，净化保持现在这样”，也可以告诉我哪里理解错了。' };
    const roomWords = clause.match(/客厅|主卧|次卧|卧室|厨房|餐厅|卫生间|书房|阳台/gu) || [];
    if (roomWords.some(room => targets.some(device => device.roomName !== room && !device.name.includes(room)))) return { reply: '这句话涉及其他空间。请先说明是要修改这件事的安排，还是调整其他空间的设备。' };
    if (targets.length > 1 && !/都|一起|全部/u.test(clause)) return { reply: `这次涉及${targets.map(device => device.name).join('、')}，请说清要改哪一项。` };
    if (/保持|不动|别动|不要改|别改|不调整|别调整|不用调|(?:不要|别|不必|不需要)(?:再)?(?:调|切|开|关)/u.test(clause)) {
      if (/调亮|调暗|太暗|太亮|\d+\s*[%％]|切换|切至/u.test(clause)) return { reply: '这句话同时提到了保持和调整，请再说一下希望采用哪个设置。' };
      for (const device of targets) {
        const mode = (getControls(device.id) || []).find(control => control.key === 'mode')?.options?.find(option => clause.includes(option.label) || clause.includes(option.value));
        if (mode && mode.value !== device.mode) return { reply: `${device.name}当前不是${mode.label}模式。你是希望切换到${mode.label}吗？请再说明最终的设置。` };
      }
      targets.forEach(device => held.add(device.id)); understood = true; continue;
    }
    for (const device of targets) {
      const target = {}, controls = getControls(device.id) || [];
      if (/关闭|关掉|关上|关灯/u.test(clause)) target.power = false;
      else if (/开启|打开|开灯/u.test(clause)) target.power = true;
      if (device.type === 'light') {
        const percent = clause.match(/(-?\d+(?:\.\d+)?)\s*[%％]/u);
        if (percent) {
          const value = Number(percent[1]);
          if (!Number.isInteger(value) || value < 1 || value > 100) return { reply: '灯光亮度可以设为1%到100%，你想调到多少？' };
          target.level = value;
        } else if (/调亮|亮一点|亮一些|太暗|再亮/u.test(clause)) target.level = Math.min(100, (device.level || 1) + 15);
        else if (/调暗|暗一点|暗一些|太亮|再暗/u.test(clause)) target.level = Math.max(1, (device.level || 1) - 15);
      }
      if (device.type === 'air') {
        const options = controls.find(control => control.key === 'mode')?.options || (device.modeOptions || []).map(value => ({ value, label: value }));
        const mode = options.find(option => clause.includes(option.label) || clause.includes(option.value)) || (/安静|小声|声音小/u.test(clause) ? options.find(option => /低噪|睡眠/u.test(option.label)) : null);
        if (mode) target.mode = mode.value;
      }
      if (!Object.keys(target).length) return { reply: `想把${device.name}怎么调整？可以说明亮度、开关或可用的净化模式。` };
      if ('level' in target && target.power === false) return { reply: '请确认是关闭灯光，还是调整亮度。' };
      if (Object.keys(target).some(key => !controls.some(control => control.key === key))) return { reply: `${device.name}目前不支持这项调整，可以再说一下其他需要。` };
      if (Object.keys(target).some(key => key !== 'power') && device.power === false && target.power !== true) return { reply: `${device.name}目前已关闭，要先打开再调整吗？请把期望的开关和设置一起告诉我。` };
      const previous = commands.get(device.id)?.target || {};
      if (Object.entries(target).some(([key, value]) => key in previous && previous[key] !== value)) return { reply: `对${device.name}有两个不同的设置，请再确认一下最终希望怎么调。` };
      commands.set(device.id, { ...baseline(device), target: { ...previous, ...target } }); understood = true;
    }
  }
  if (!understood || [...held].some(id => commands.has(id))) return { reply: '请再说清哪些需要调整、哪些保持现在这样，我会先和你确认。' };
  const effective = [...commands.values()].filter(command => Object.entries(command.target).some(([key, value]) => devices.find(device => device.id === command.id)?.[key] !== value));
  const describe = command => {
    const device = linked.find(entry => entry.id === command.id), parts = [];
    if ('power' in command.target) parts.push(command.target.power ? '开启' : '关闭');
    if ('level' in command.target) parts.push(`亮度调至${command.target.level}%`);
    if ('mode' in command.target) parts.push(`切至${command.target.mode}模式`);
    return `${device.name}${parts.join('，')}`;
  };
  if (!effective.length && !correction) return { reply: '目前已经是这个设置，这次不需要再调整。' };
  const kept = linked.filter(device => !effective.some(command => command.id === device.id));
  const lines = effective.map(describe);
  if (correction) lines.push(`更正这次理解：${correction}`);
  if (effective.length && kept.length) lines.push(`${kept.map(device => device.name).join('、')}保持当前设置`);
  return { commands: effective, correction, lines, baselines: linked.map(baseline), input: text, reply: `准备这样修改：${lines.join('；')}。这样可以吗？` };
}

export function createEventAdjustment({ sheet, openSheet, getDevices, getControls, requestControl, onRecord, onUpdate, toast }) {
  const doc = sheet.ownerDocument, e = escapeHTML, sessions = new Map();
  let active = null, serial = 0, voiceTimer = null, voiceText = '', voiceDraft = '', disposed = false;
  const voice = doc.createElement('dialog');
  voice.className = 'chat-voice-dialog'; voice.id = 'event-adjustment-voice'; voice.setAttribute('aria-label', '语音输入');
  voice.innerHTML = '<div class="chat-voice-surface"><button class="chat-voice-cancel" data-ea-voice="cancel">取消</button><p class="chat-voice-transcript" aria-live="polite"></p><div class="chat-voice-samples"><span>也可以这样说</span></div><p class="chat-voice-caption" role="status">正在听，点击下方结束</p><button class="chat-listening-bar" data-ea-voice="end" aria-label="结束语音输入"><span class="asset chat-wave"><img src="assets/voice.svg" alt=""></span></button><span class="home-indicator" aria-hidden="true"></span></div>';
  doc.querySelector('#app').append(voice);
  const current = () => active && sessions.get(active);
  const visible = session => !disposed && active === session.item.id && sheet.open && sheet.dataset.content === 'event-adjustment';
  const input = () => sheet.querySelector('#ea-input');
  const wave = '<span class="asset chat-action-wave"><img src="assets/voice.svg" alt=""></span>';
  const send = '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="url(#ea-send-gradient)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><defs><linearGradient id="ea-send-gradient" x1="4" y1="4" x2="20" y2="20"><stop stop-color="#007aff"/><stop offset="1" stop-color="#f96222"/></linearGradient></defs><path d="M12 19V5m-6 6 6-6 6 6"/></svg>';
  function message(session, role, text, proposal = false) { const value = { id: ++serial, role, text, proposal }; session.messages.push(value); return value; }
  function composer(session) {
    if (!visible(session)) return;
    const field = input(), button = sheet.querySelector('#ea-action'), hasText = Boolean(field.value.trim());
    field.disabled = session.busy; button.disabled = session.busy;
    sheet.querySelectorAll('[data-ea-confirm]').forEach(target => { target.disabled = session.busy || hasText || !session.pending || Number(target.dataset.eaConfirm) !== session.pendingMessage; });
    button.dataset.mode = hasText ? 'send' : 'voice'; button.setAttribute('aria-label', hasText ? '发送' : '语音输入'); button.innerHTML = hasText ? send : wave;
    field.style.height = '26px'; field.style.height = `${Math.min(78, Math.max(26, field.scrollHeight))}px`;
  }
  function render(session) {
    if (!visible(session)) return;
    const flow = sheet.querySelector('.ea-flow'), nearEnd = flow.scrollHeight - flow.scrollTop - flow.clientHeight < 70, top = flow.scrollTop;
    flow.innerHTML = session.messages.map(entry => `<div class="ea-message is-${entry.role}"><p>${e(entry.text)}</p>${entry.proposal ? `<button class="ea-confirm" data-ea-confirm="${entry.id}" ${session.busy || session.pendingMessage !== entry.id || !session.pending ? 'disabled' : ''}>确认修改</button>` : ''}</div>`).join('');
    flow.scrollTop = nearEnd ? flow.scrollHeight : top; composer(session);
  }
  function cancelVoice(restore = true) {
    clearTimeout(voiceTimer); voiceTimer = null; if (voice.open) voice.close();
    const session = current();
    if (restore && session && visible(session)) { input().value = voiceDraft; session.draft = voiceDraft; composer(session); sheet.querySelector('#ea-action').focus({ preventScroll: true }); }
  }
  function detach() { cancelVoice(false); const session = current(); if (session) { session.draft = input()?.value || ''; if (!session.busy) { session.pending = null; session.pendingMessage = null; } } active = null; }
  function open(item, { onReturn, restoreFocus } = {}) {
    detach();
    let session = sessions.get(item.id);
    if (!session) { session = { item, originalStatus: item.status, originalState: item.state, failedDevices: new Set(), messages: [], pending: null, pendingMessage: null, draft: '', busy: false }; message(session, 'assistant', '想怎么调整，或者哪里理解错了？'); sessions.set(item.id, session); }
    session.item = item; active = item.id;
    openSheet('调整或纠正', `<div class="ea-context"><span>关于这件事</span><strong>${e(item.title)}</strong><p>${e(item.summary)}</p></div><div class="ea-flow" role="log" aria-label="事件调整对话" aria-live="polite"></div><form class="ea-composer" id="ea-form"><div class="chat-composer-shell"><div class="chat-input-row"><textarea id="ea-input" rows="1" maxlength="300" placeholder="告诉小元，哪里需要调整" aria-label="告诉小元，哪里需要调整" enterkeyhint="send"></textarea></div><div class="chat-input-tools"><span aria-hidden="true"></span><button class="chat-action" id="ea-action" type="button" data-mode="voice" aria-label="语音输入">${wave}</button></div></div></form>`, { onCancel: () => { detach(); if (onReturn) onReturn(); else sheet.close(); }, restoreFocus });
    sheet.dataset.content = 'event-adjustment'; input().value = session.draft; render(session);
    sheet.querySelector('#ea-form').onsubmit = event => { event.preventDefault(); submit(); };
    input().oninput = () => { session.draft = input().value; composer(session); };
    input().onkeydown = event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); submit(); } };
    sheet.querySelector('#ea-action').onclick = () => input().value.trim() ? submit() : openVoice();
  }
  function submit() {
    const session = current(); if (!session || session.busy || !visible(session)) return;
    const text = input().value.trim(); if (!text) return;
    input().value = ''; session.draft = ''; message(session, 'user', text);
    if (confirmText(text) && session.pending) { render(session); confirm(session); return; }
    session.pending = null; session.pendingMessage = null;
    if (cancelText(text)) message(session, 'assistant', '好的，这次不作修改。');
    else {
      const plan = planEventCorrection(text, session.item, getDevices(), getControls);
      session.pending = plan.commands ? plan : null;
      const answer = message(session, 'assistant', plan.reply, Boolean(session.pending));
      session.pendingMessage = session.pending ? answer.id : null;
    }
    render(session);
  }
  async function confirm(session) {
    if (session.busy || !session.pending) return;
    const plan = session.pending, latest = getDevices();
    const changed = plan.commands.length && plan.baselines.some(old => { const device = latest.find(entry => entry.id === old.id); return !device || !same(old, baseline(device)) || device.pending; });
    const unavailable = plan.commands.some(command => { const device = latest.find(entry => entry.id === command.id); return !device?.online || !device.permissions?.control; });
    session.pending = null; session.pendingMessage = null;
    if (changed || unavailable) { message(session, 'assistant', changed ? '设备状态已经变化，请按现在的情况重新告诉我需要怎样修改。' : '相关设备暂时离线或没有控制权限，这次还没有执行修改。连接恢复后可以再告诉我。'); render(session); return; }
    session.busy = true; const feedback = message(session, 'assistant', plan.commands.length ? '正在调整，等待设备反馈…' : '正在记录这次纠正…'); render(session);
    const results = [];
    for (const command of plan.commands) {
      let result;
      try { result = await requestControl(command.id, command.target, { serviceId: session.item.id, expectedRevision: command.revision, expectedRoomId: command.roomId }); }
      catch { result = { ok: false, message: '暂未收到设备反馈' }; }
      results.push({ command, result });
    }
    const ok = results.filter(entry => entry.result?.ok), failed = results.filter(entry => !entry.result?.ok);
    for (const entry of results) entry.result?.ok ? session.failedDevices.delete(entry.command.id) : session.failedDevices.add(entry.command.id);
    const now = previewNow(), recordText = [plan.correction ? `用户纠正：${plan.correction}` : '', ...results.map(({ command, result }) => `${getDevices().find(device => device.id === command.id)?.name || '原设备'}：${result?.ok ? result.device?.statusText || '设备已确认' : result?.message || '尚未确认'}`)].filter(Boolean).join('；');
    session.busy = false;
    if (failed.length) feedback.text = `${ok.length ? `${ok.length}项调整已确认；` : ''}${failed.map(entry => `${getDevices().find(device => device.id === entry.command.id)?.name || '设备'}${entry.result?.message || '尚未确认'}`).join('；')}。可以继续说明要修改的内容。`;
    else feedback.text = plan.commands.length ? `${plan.lines.join('；')}。设备已确认本次调整。` : '已记录你对这件事的纠正，相关设备保持当前设置。';
    const oldCorrections = session.item.eventCorrections || [];
    const eventCorrections = plan.correction ? [...oldCorrections, { text: plan.correction, at: now }] : oldCorrections;
    const summary = failed.length ? recordText : plan.commands.length ? `${plan.lines.join('；')}，设备已确认` : session.item.summary;
    const update = { id: session.item.id, at: now, status: session.failedDevices.size ? '部分未完成' : session.originalStatus, state: session.failedDevices.size ? 'active' : session.originalState, summary, eventCorrections };
    session.item = { ...session.item, ...update };
    onUpdate?.(update);
    onRecord?.({ experienceId: session.item.id, scope: session.item.scope, label: failed.length ? '事件调整尚未完成' : plan.commands.length ? '事件调整已确认' : '用户纠正事件', text: recordText, at: now });
    render(session);
  }
  function openVoice() {
    const session = current(); if (!session || session.busy) return;
    voiceDraft = input().value; voiceText = ''; voice.querySelector('.chat-voice-transcript').textContent = '';
    const samples = session.pending ? ['确认修改', '灯光调到60%，净化保持现在这样', '取消修改'] : ['灯光再亮一点，净化保持现在这样', '刚才不是看电视，是在聊天'];
    voice.querySelector('.chat-voice-samples').innerHTML = '<span>也可以这样说</span>' + samples.map(text => `<button data-ea-utterance="${e(text)}">${e(text)}</button>`).join('');
    voice.querySelector('.chat-voice-caption').textContent = '正在听，点击下方结束'; voice.dataset.phase = 'listening';
    voice.style.setProperty('--frame-top', `${doc.querySelector('#app').getBoundingClientRect().top}px`); voice.showModal(); voice.querySelector('[data-ea-voice="end"]').focus({ preventScroll: true });
  }
  voice.addEventListener('click', event => {
    const sample = event.target.closest('[data-ea-utterance]');
    if (sample) {
      clearTimeout(voiceTimer); voiceText = sample.dataset.eaUtterance; let length = 0;
      const show = () => { if (!voice.open) return; voice.querySelector('.chat-voice-transcript').textContent = [...voiceText].slice(0, length += 2).join(''); if (length < [...voiceText].length) voiceTimer = setTimeout(show, 55); }; show();
      voice.querySelector('.chat-voice-caption').textContent = '点击下方结束，转成文字'; return;
    }
    if (event.target.closest('[data-ea-voice="end"]')) {
      if (!voiceText.trim()) { voice.querySelector('.chat-voice-caption').textContent = '还没听到内容，可以再说一次'; return; }
      const text = [voiceDraft, voiceText].filter(Boolean).join(' '); cancelVoice(false);
      if (current()) { input().value = text; current().draft = text; composer(current()); input().focus({ preventScroll: true }); toast?.('已转成文字，可以修改后发送'); }
    } else if (event.target.closest('[data-ea-voice="cancel"]') || event.target === voice || event.target.classList.contains('chat-voice-surface')) cancelVoice();
  });
  voice.addEventListener('cancel', event => { event.preventDefault(); cancelVoice(); });
  sheet.addEventListener('click', event => { const button = event.target.closest('[data-ea-confirm]'), session = current(); if (button && session && !button.disabled && visible(session) && Number(button.dataset.eaConfirm) === session.pendingMessage) confirm(session); });
  sheet.addEventListener('close', () => { if (!sheet.open) detach(); });
  return { open, detach, destroy() { disposed = true; detach(); voice.remove(); sessions.clear(); } };
}
