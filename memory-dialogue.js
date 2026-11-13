import {inferMemoryScope,parseMemoryScopeCorrection} from './memory-scope.js?v=memory-auto-scope-20261113';
import {parseMemoryInstruction, resolveDate, memoryCorrectionSamples} from './memory-assistant.js?v=memory-dialogue-20261113';

const clone = value => structuredClone(value);
const clean = value => String(value ?? '').trim().replace(/[。！!]+$/u, '');
const key = value => clean(value).normalize('NFKC').replace(/[\s，,。；;：:]/gu, '');
const fields = ['id','memoryId','ownerId','scope','messages','draft','scroll','clarification','undo','privacyVersion'];
const serialize = session => Object.fromEntries(fields.map(field => [field, clone(session[field] ?? null)]));
const version = item => item ? `${item.revision || 0}:${item.updatedAt}` : null;
const scopeName = scope => scope === 'family' ? '家庭共享' : '仅自己';

export function readMemoryDialogue(storage, storageKey) {
  try {
    const data = JSON.parse(storage.getItem(storageKey));
    return [1,2].includes(data?.version) && Array.isArray(data.records) && Array.isArray(data.threads) ? data : null;
  } catch { return null; }
}

// A local prototype of memory conversations, not an LLM, ASR, or production identity system.
export function createMemoryDialogue({store, getActor, getRooms = () => [], storage, storageKey, initial = null, now = () => Date.now(), failWrite = false}) {
  const sessions = clone(initial?.threads || []);
  const listeners = new Set();
  let failedOnce = false;
  for (const session of sessions) {
    session.privacyVersion = 2;
    session.messages ||= [];
    for (const message of session.messages) if (message.processing) {
      message.processing = null;
      message.text = '上次处理已中断，记忆没有因此更新。可以重新发送。';
      message.blocks = []; message.stopped = true;
    }
  }
  const actor = () => getActor?.() || null;
  const item = session => session?.ownerId===actor()?.id && session.memoryId ? store.get(session.memoryId) : null;
  const allowed = session => Boolean(actor()) && session.ownerId===actor().id && (!session.memoryId || Boolean(item(session)));
  const snapshot = () => ({version:2, records:store.dumpForReview(), threads:sessions.map(serialize)});
  function persist() { storage.setItem(storageKey, JSON.stringify(snapshot())); }
  function checkpoint(session) {
    if (session && !allowed(session)) return false;
    try { persist(); listeners.forEach(fn => fn()); return true; } catch { return false; }
  }
  // Changes made by scenes also survive refresh, without copying their content into conversations.
  store.subscribe(() => checkpoint());
  function open(memoryId = null, {fresh = false} = {}) {
    if (!actor() || memoryId && !store.get(memoryId)) return null;
    let session = fresh ? null : sessions.findLast(s => s.ownerId === actor().id && (memoryId ? s.memoryId === memoryId : !s.memoryId));
    if (!session) {
      const current = memoryId ? store.get(memoryId) : null;
      session = {id:'memory-chat-'+crypto.randomUUID(), memoryId, ownerId:actor().id, scope:current?.visibility || 'personal', messages:[], draft:'', scroll:0, clarification:null, undo:null,privacyVersion:2};
      sessions.push(session);
    }
    return session;
  }
  function summary(memoryId) {
    if (!store.get(memoryId)) return null;
    const session = sessions.find(s => s.memoryId === memoryId && s.ownerId === actor()?.id);
    if (!session) return null;
    const messages = session.messages.filter(m => !m.intro);
    return {count:messages.length,lastText:messages.at(-1)?.text || ''};
  }
  function reply(session, message, text, blocks = []) {
    message.text = text; message.blocks = blocks; message.processing = null;
    checkpoint(session); return {ok:true};
  }
  function commit(session, message, action, success) {
    const before = {memoryId:session.memoryId,scope:session.scope,undo:clone(session.undo),clarification:clone(session.clarification)};
    try {
      const result = store.batch(() => {
        const result = action();
        if (result.ok) { success(result); message.processing = null; }
        return result;
      }, () => {
        if (failWrite && !failedOnce) { failedOnce = true; throw new Error('Preview write failure'); }
        persist();
      });
      if (!result?.ok) { Object.assign(session,before); return reply(session,message,result?.error || '还没有保存，请重新说明要记住的内容。'); }
      listeners.forEach(fn => fn());
      return result;
    } catch {
      Object.assign(session,before);
      session.draft = session.messages.filter(m => m.role === 'user').at(-1)?.text || session.draft;
      return reply(session,message,'这次没有保存成功，记忆保持原样。内容已留在输入框，可以重新发送。');
    }
  }
  const viewBlock = session => ({type:'memory-result',memoryId:session.memoryId});
  function respond(session, instruction, message, baseline) {
    if (!allowed(session)) return reply(session,message,'这条记忆已不可用，请返回记忆列表。');
    let text = clean(instruction);
    const current = item(session);
    if (current && version(current) !== baseline) return reply(session,message,'这条记忆刚有了新的调整。请查看上方的最新内容，再告诉我如何修改。');
    if (/^(?:取消|算了|先不改|先不调整|不改了|不用改了)$/u.test(text)) {
      session.clarification = null;
      return reply(session,message,'好，先保持原样，刚才的对话会留在这里。');
    }
    if (!text || /^(?:可以|好的?|确认|就这样|不对|改一下|调整一下|修改一下|记住|补充一下)$/u.test(text)) return reply(session,message,current ? '想具体改成什么？可以直接告诉我新的内容。' : '有什么希望我记住的？说一件具体的事就好。');
    if (/[?？]$/u.test(text) || /^(?:为什么|怎么|是否|能不能|是不是)/u.test(text)) return reply(session,message,current ? `现在记住的是「${current.text}」。你可以告诉我哪里需要补充或纠正。` : '你可以直接告诉我希望记住的偏好或安排，例如「我睡觉时不喜欢空调直吹」。');
    if (/(?:删除|忘掉|忘记|清空)/u.test(text)) return reply(session,message,current ? '可以说「先别用这条记忆」，我会停止参考，保留这段记录。' : '还没有新增记忆，你可以直接返回。');
    const scopeCorrection=parseMemoryScopeCorrection(text);
    if(scopeCorrection){
      if(!current)return reply(session,message,'好的，再告诉我具体希望记住什么，我会结合内容整理。');
      return correctScope(session,scopeCorrection,message,current);
    }

    const clarification = session.clarification;
    if (clarification?.kind === 'clock') {
      const time = text.match(/(?:^|改[为成到]?|晚上|现在)(\d{1,2})[:：点](\d{1,2})?(?:分)?(?:睡觉|休息|吧|了)?$/u);
      if (time && Number(time[1]) < 24 && Number(time[2] || 0) < 60) {
        const clock = time[1].padStart(2,'0') + ':' + (time[2] || '00').padStart(2,'0');
        text = '把这条记忆改为：' + current.text.replace(/\d{1,2}:\d{2}/u, clock);
      } else if (/^(?:\d|晚上|晚一点|早一点)/u.test(text)) return reply(session,message,'具体几点呢？例如「23:30」。');
    }
    if (current && /(?:早一点|晚一点|提前一点|推迟一点)/u.test(text) && /\d{1,2}:\d{2}/u.test(current.text)) {
      session.clarification = {kind:'clock'};
      return reply(session,message,'具体改为几点？例如「23:30」。');
    }
    if (current) return update(session, text, message, current, instruction);
    return add(session, text, message, instruction);
  }

  function add(session, text, message, original) {
    text = text.replace(/^(?:(?:小元[，,]?\s*)?(?:请|帮我)?(?:记住|记一下|记下来|记下|记录一下|记录|记得|记一件事))[，,：:]?\s*/u,'');
    let type = 'long', expiresAt = null;
    if (session.clarification?.kind === 'expiry') {
      expiresAt = resolveDate(text.replace(/^(?:到|记到|截至|适用至)/u,''), store.today());
      if (!expiresAt) return reply(session,message,'记到哪一天呢？例如「本周末」或一个具体日期。');
      text = session.clarification.text; type = 'short';
    } else {
      if (/这几天|最近几天|过几天|暂时/u.test(text)) {
        session.clarification = {kind:'expiry',text};
        return reply(session,message,'这件事希望先记到哪一天？例如「本周末」。');
      }
      const expiry = text.match(/(?:适用至|适用到|记到|截至|截止到)[：:]?\s*(今天|明天|后天|本周末|下周五|\d{4}[年/.\-]\d{1,2}[月/.\-]\d{1,2}日?)$/u);
      expiresAt = expiry ? resolveDate(expiry[1],store.today()) : /这周|本周/u.test(text) ? resolveDate('本周末',store.today()) : /今天|今晚/u.test(text) ? store.today() : null;
      if (expiresAt) type = 'short';
      if (expiry) text = clean(text.slice(0,expiry.index));
    }
    if ([...text].length < 4 || /(?:一点|这样|那个|随便|某个)$/u.test(text)) return reply(session,message,'再具体说一点，希望我记住什么？');
    if (/^(?:打开|关闭|调高|调低|调到|关掉|开启|执行)/u.test(text)) return reply(session,message,'这里用来记住偏好和安排。如果希望今后也这样做，可以告诉我适用的情况。');
    if ([...text].length > 80) return reply(session,message,'这次先记一件事，请把要记住的内容控制在80字以内。');
    session.scope=inferMemoryScope(text);
    const same = store.getMemories().find(m => m.visibility === session.scope && key(m.text) === key(text) && m.type === type && m.expiresAt === expiresAt);
    if (same) {
      const prior = sessions.find(s => s !== session && s.memoryId === same.id && s.ownerId === session.ownerId);
      const oldMessages = session.messages, oldId = session.memoryId;
      if (prior) session.messages = [...prior.messages,...oldMessages.filter(m => !m.intro)];
      session.memoryId = same.id; session.scope = same.visibility; session.clarification = null;
      message.text = `已经记住这件事了，继续在这条记忆里补充即可。${!same.enabled ? '仍保持停用。' : same.expired ? '原记录已到期。' : ''}`;
      message.blocks = [viewBlock(session)]; message.processing = null;
      const priorIndex=prior?sessions.indexOf(prior):-1;
      if(prior) sessions.splice(priorIndex,1);
      try { persist(); listeners.forEach(fn=>fn()); return {ok:true}; }
      catch {if(prior)sessions.splice(priorIndex,0,prior);session.messages=oldMessages;session.memoryId=oldId;return reply(session,message,'这次对话暂时无法保存，请稍后重试。');}
    }
    return commit(session,message,() => store.create({text,type,expiresAt,visibility:session.scope,evidenceText:original,privateEvidence:true}), result => {
      session.memoryId = result.id; session.clarification = null;
      message.text = `记住了：${result.item.text}。\n${session.scope === 'family' ? '已记为家庭共同约定。' : '已记为个人记忆，仅自己可见。'}${type === 'short' ? ' · '+result.item.periodText : ''}`;
      message.blocks = [viewBlock(session)];
    });
  }

  function correctScope(session,scope,message,current){
    if(current.visibility===scope)return reply(session,message,scope==='family'?'这条已经是家庭共同约定，家人可以查看。我们的这段对话仍仅你可见。':'这条已记为个人记忆，仅你可见。');
    return commit(session,message,()=>store.reclassify(current.id,scope),result=>{
      session.scope=result.item.visibility;
      session.undo={id:message.id,before:current,revision:result.item.revision || 0};
      message.text=scope==='family'?'已改为家庭共同约定，家人可以查看这条记忆。我们的原始对话仍仅你可见。':'已改为个人记忆，仅你可见。原来的对话会继续保留。';
      message.blocks=[viewBlock(session),{type:'memory-undo',undoId:message.id}];
    });
  }

  function update(session, text, message, current, original) {
    let plan = parseMemoryInstruction(text,current,{today:store.today(),rooms:getRooms()});
    if (!plan.ok) {
      let content = text.replace(/^(?:补充一下|补充|纠正一下|纠正|其实|不对|现在改为)[，,：:]?\s*/u,'');
      const descriptive = /我(?:们)?(?:现在|一般|通常|喜欢|不喜欢|习惯|希望|睡觉)|以后|睡觉时|有人休息|工作日|整理资料|汇报|晚上|白天|空调|灯光/u.test(content);
      const otherTopic = /空调|喝水|用餐|睡觉/u.test(content) && /汇报|资料|笔记/u.test(current.text) || /汇报|资料|笔记/u.test(content) && /空调|灯光|休息/u.test(current.text);
      if (otherTopic) return reply(session,message,'这像是另一件事，可以从记忆页另记一条，当前这条先保持原样。');
      if (descriptive && !/(?:恢复|启用|停用|删除|期限|改到|延到|空间改|不再使用|直吹吗)/u.test(content) && !/(?:怎么|是否|可能|也许|假如|如果以后|能不能)/u.test(content)) {
        if (/^(?:补充一下|补充)/u.test(text)) content = current.text + '；' + content;
        plan = parseMemoryInstruction('把这条记忆改为：'+content,current,{today:store.today(),rooms:getRooms()});
      }
    }
    if (!plan.ok) return reply(session,message,plan.message);
    return commit(session,message,() => {
      let result = Object.keys(plan.patch).length ? store.update(current.id,{...plan.patch,evidenceText:original,privateEvidence:true}) : {ok:true,item:current,id:current.id};
      if (result.ok && typeof plan.enabled === 'boolean' && result.item.enabled !== plan.enabled) result = store.setEnabled(current.id,plan.enabled);
      return result;
    }, result => {
      session.clarification = null;
      session.scope=result.item.visibility;
      session.undo = {id:message.id,before:current,revision:result.item.revision || 0};
      const contentChanged = plan.patch.text !== undefined;
      message.text = contentChanged ? `已更新：${result.item.text}。` : plan.enabled === false ? '已暂停使用这条记忆，原来的内容和对话仍会保留。' : plan.enabled === true ? '已恢复使用这条记忆。' : `已更新${plan.summary}。${result.item.periodText}。`;
      if (contentChanged && !result.item.enabled) message.text += '\n这条记忆仍保持停用。';
      if (contentChanged && result.item.expired) message.text += '\n这条记忆仍已到期，不会继续参考。';
      message.blocks = [viewBlock(session),{type:'memory-undo',undoId:message.id}];
    });
  }
  function undo(session, undoId, message) {
    const entry = session.undo;
    if (!allowed(session) || !entry || entry.id !== undoId) return reply(session,message,'这次更新已不能直接撤销，可以告诉我新的修改。');
    return commit(session,message,() => store.restore(session.memoryId,entry.before,entry.revision), result => {
      session.undo = null;
      session.scope=result.item.visibility;
      message.text = `已撤销这次更新，恢复为：${result.item.text}。`;
      message.blocks = [viewBlock(session)];
    });
  }
  return {
    now,
    actorName:() => actor()?.name || '你',
    open,item,version,allowed,summary,checkpoint,respond,undo,snapshot,
    samples:session => item(session) ? [memoryCorrectionSamples(item(session))[0],item(session).visibility==='family'?'这条只针对我':'这是全家的约定',memoryCorrectionSamples(item(session))[2]] : ['记住，我睡觉时不喜欢空调直吹','记住，我们家晚上十点后，公共区域尽量保持安静','记住，晚上灯光柔和一些'],
    subscribe(fn){listeners.add(fn);return () => listeners.delete(fn);},
    sync(threads){if(!Array.isArray(threads))return;sessions.splice(0,sessions.length,...clone(threads));checkpoint();},
  };
}
