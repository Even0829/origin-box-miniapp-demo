import {conversationSeeds,attachmentSamples} from './conversation-data.js';
import {previewNow,previewDate} from './preview-clock.js';
import {parseMemoryInstruction,memoryCorrectionSamples} from './memory-assistant.js?v=memory-chat-20261016';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=value=>String(value??'').replace(/[。．.]+$/u,'');
const uid=()=>crypto.randomUUID();
const clock=()=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(previewNow());
const day=previewDate;
const glyphs={
  history:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  new:'<path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><path d="m9 15 1-4 8-8a2.12 2.12 0 0 1 3 3l-8 8-4 1ZM16 5l3 3"/>',
  send:'<path d="M12 19V5m-6 6 6-6 6 6"/>',
  voice:'<path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4"/>',
  stop:'<rect x="7" y="7" width="10" height="10" rx="1" fill="currentColor" stroke="none"/>',
  file:'<path d="M14 3H6v18h12V7l-4-4Zm0 0v5h4M8 12h8M8 16h5"/>',
  copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H4v13h4"/>',
  image:'<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8" cy="9" r="1.5"/><path d="m3 16 5-4 4 4 4-6 5 6"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  schedule:'<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h6"/>'
};
const chatIcon=name=>'<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(glyphs[name]??glyphs.file)+'</svg>';
const actionIcon=name=>name==='voice'?'<span class="asset chat-action-wave"><img src="assets/voice.svg" alt=""></span>':'<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="url(#chat-action-gradient)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><defs><linearGradient id="chat-action-gradient" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse"><stop stop-color="#007aff"/><stop offset="1" stop-color="#f96222"/></linearGradient></defs>'+glyphs[name].replace('fill="currentColor"','fill="url(#chat-action-gradient)"')+'</svg>';

export function createConversation({icon,setView,onHome,openSheet,toast,getRooms,getLampLevel,getLampDevice,onRecord,onDevice,startAir,cancelAir}){
  const $=s=>document.querySelector(s);
  const page=document.createElement('section');
  page.id='chat-page';page.className='chat-page';page.hidden=true;page.setAttribute('aria-labelledby','chat-title');
  page.innerHTML='<header class="chat-header"><button id="chat-back" class="icon-button" aria-label="返回首页">'+icon('back')+'</button><div class="chat-heading"><h1 id="chat-title">小元</h1><p class="chat-subtitle" id="chat-subtitle">生活与工作，一起理清</p></div><button id="chat-new" class="icon-button" aria-label="新会话">'+chatIcon('new')+'</button><button id="chat-history" class="icon-button" aria-label="会话记录">'+chatIcon('history')+'</button></header>'
    +'<main class="chat-flow" id="chat-flow" aria-label="与小元的会话"></main><button class="chat-new-content" id="chat-new-content" hidden>有新内容 '+icon('chevron')+'</button>'
    +'<footer class="chat-composer-wrap"><form id="chat-form"><div class="chat-composer-shell"><div id="chat-attachments" class="chat-draft-attachments" hidden></div><div class="chat-input-row"><textarea id="chat-input" rows="1" maxlength="2000" placeholder="告诉小元，你想做什么" aria-label="告诉小元" enterkeyhint="send"></textarea></div><div class="chat-input-tools"><button type="button" id="chat-add" class="icon-button" aria-label="添加图片或文件">'+icon('plus')+'</button><button id="chat-action" class="chat-action" type="button" data-mode="voice" aria-label="语音输入">'+actionIcon('voice')+'</button></div></div></form><span class="home-indicator chat-bottom-indicator" aria-hidden="true"></span></footer>'
    +'<section id="chat-reader" class="chat-reader" hidden aria-labelledby="chat-reader-title"><header class="chat-header"><button id="chat-reader-back" class="icon-button" aria-label="返回会话">'+icon('back')+'</button><div class="chat-heading"><h1 id="chat-reader-title"></h1><p id="chat-reader-meta" class="chat-subtitle"></p></div></header><div class="chat-reader-content" id="chat-reader-content"></div><footer class="chat-reader-actions"><button id="chat-reader-copy" class="secondary-button">'+chatIcon('copy')+'<span>复制内容</span></button><button id="chat-reader-use" class="primary-button">继续调整</button><span class="home-indicator" aria-hidden="true"></span></footer></section>'
    +'<input id="chat-file-input" type="file" accept="image/*,.txt,.md,.csv,.pdf,.docx" multiple hidden>';
  $('#app').insertBefore(page,$('#toast'));
  const voice=document.createElement('dialog');voice.id='chat-voice-dialog';voice.className='chat-voice-dialog';
  voice.setAttribute('aria-label','语音输入');
  voice.innerHTML='<div class="chat-voice-surface"><button id="chat-voice-cancel" class="chat-voice-cancel">取消</button><p class="chat-voice-transcript" id="chat-voice-transcript" aria-live="polite"></p><div class="chat-voice-samples" id="chat-voice-samples"><span>也可以这样说</span><button data-utterance="把客厅灯调到60%">把客厅灯调到60%</button><button data-utterance="帮我安排明天的事情">帮我安排明天的事情</button><button data-utterance="把这份资料整理成要点">把这份资料整理成要点</button></div><p class="chat-voice-caption" id="chat-voice-caption" role="status">正在听，点击下方结束</p><button class="chat-listening-bar" id="chat-voice-end" aria-label="结束语音输入"><span class="asset chat-wave"><img src="assets/voice.svg" alt=""></span></button><span class="home-indicator" aria-hidden="true"></span></div>';
  $('#app').append(voice);
  const historyDrawer=document.createElement('dialog');historyDrawer.id='chat-history-drawer';historyDrawer.className='chat-history-drawer';
  historyDrawer.setAttribute('aria-label','历史会话');
  historyDrawer.innerHTML='<button class="chat-history-scrim" id="chat-history-scrim" aria-label="返回会话" tabindex="-1"></button><aside class="chat-history-panel"><div class="chat-history-tools"><label class="chat-history-search">'+chatIcon('search')+'<input id="chat-history-search" type="search" placeholder="搜索会话" aria-label="搜索会话" maxlength="100" autocomplete="off"><button type="button" id="chat-history-clear" aria-label="清空搜索" hidden>'+icon('close')+'</button></label><button class="chat-history-close" id="chat-history-close" aria-label="关闭历史会话" autofocus>'+icon('close')+'</button></div><div class="chat-history-scroll" id="chat-history-results" aria-label="会话标题列表"></div><div class="chat-history-context" id="chat-history-context" role="menu" aria-label="会话操作" hidden><button role="menuitem" data-history-action="rename">'+icon('edit')+'<span>重命名</span></button><button role="menuitem" class="danger" data-history-action="delete">'+icon('trash')+'<span>删除</span></button></div></aside><span class="home-indicator" aria-hidden="true"></span>';
  $('#app').append(historyDrawer);
  const flow=$('#chat-flow'),input=$('#chat-input');
  const conversations=structuredClone(conversationSeeds).map(s=>({...s,updatedAt:Date.parse(s.date+'T'+s.time+':00+08:00'),messages:s.messages.map(m=>({...m,historical:true})),draft:'',attachments:[],scroll:0,busy:null}));
  let activeId=null,readerOrigin=null,readerBody='',voiceText='',voiceDraft='',voiceTimer=null,voiceVersion=0,memorySession=null;
  const airBindings=new Map();
  const serviceSessions=new Map();
  const current=()=>memorySession??conversations.find(s=>s.id===activeId);
  const visible=s=>s.id===activeId&&!page.hidden&&$('#chat-reader').hidden;
  const nearBottom=()=>flow.scrollHeight-flow.scrollTop-flow.clientHeight<80;
  const writeRecord=data=>onRecord?.(data);
  function makeConversation(){
    const s={id:uid(),title:'新的会话',date:day,time:clock(),updatedAt:previewNow(),scope:'personal',messages:[],draft:'',attachments:[],scroll:0,busy:null};
    conversations.unshift(s);activeId=s.id;return s;
  }
  function saveDraft(){const s=current();if(s){s.draft=input.value;s.scroll=flow.scrollTop;}}
  function open(kind){
    $('#chat-back').setAttribute('aria-label','返回首页');
    if(memorySession)discardMemory();else saveDraft();if(!current())makeConversation();setView('chat');page.hidden=false;
    if(kind&&kind!=='home')current().draft=kind==='work'?'帮我整理一份汇报材料':'帮我安排明天的事情';
    renderFlow();renderComposer();flow.scrollTop=current().scroll??0;$('#chat-back').focus({preventScroll:true});window.scrollTo(0,0);
  }
  function openService({serviceId,title,prompt,scope='personal',fromCard=false}={}){
    if(memorySession)discardMemory();else saveDraft();
    let session=conversations.find(item=>item.id===serviceSessions.get(serviceId));
    if(!session){
      session=makeConversation();session.title=title||'接着聊这件事';session.scope=scope;
      session.serviceContext={serviceId,title,scope};
      session.messages.push({id:uid(),role:'assistant',text:`接着聊“${title||'这件事'}”。你可以补充资料、调整要求，或告诉我接下来想怎么做`,time:clock(),blocks:[]});
      session.draft=prompt||'';serviceSessions.set(serviceId,session.id);
    }
    activeId=session.id;setView('chat');page.hidden=false;renderFlow();renderComposer();flow.scrollTop=session.scroll||0;
    $('#chat-back').setAttribute('aria-label',fromCard?'返回关注照料':'返回服务详情');$('#chat-back').focus({preventScroll:true});
  }
  function back(){
    if(voice.open){cancelVoice();return;}
    if(historyDrawer.open){if(!$('#chat-history-context').hidden)hideHistoryMenu(true);else closeHistory();return;}
    if(!$('#chat-reader').hidden){closeReader();return;}
    if(memorySession){const onReturn=memorySession.memory.onReturn;discardMemory();if(onReturn)onReturn();else onHome();return;}
    saveDraft();onHome();
  }
  function discardMemory(){
    const s=memorySession;if(!s)return;
    if(voice.open)cancelVoice();stop(s);memorySession=null;activeId=s.previousId;
    delete page.dataset.kind;
    if(current()){renderFlow();renderComposer();flow.scrollTop=current().scroll??0;}else{input.value='';$('#chat-new').hidden=false;$('#chat-history').hidden=false;$('#chat-add').hidden=false;input.maxLength=2000;}
  }
  function openMemoryCorrection({item,onConfirm,onReturn,today=previewDate}){
    if(!item?.id){toast('请先打开要纠正的记忆');return;}
    if(memorySession)discardMemory();else saveDraft();
    const previousId=activeId;
    const s={id:'memory-'+uid(),kind:'memory',previousId,title:'纠正记忆',date:day,time:clock(),updatedAt:previewNow(),scope:'personal',messages:[],draft:'',attachments:[],scroll:0,busy:null,memory:{item:structuredClone(item),onConfirm,onReturn,today,pending:null,pendingMessageId:null}};
    s.messages.push({id:uid(),role:'assistant',text:'想怎么调整这条记忆？',time:clock(),blocks:[]});
    memorySession=s;activeId=s.id;page.dataset.kind='memory';$('#chat-reader').hidden=true;
    setView('chat');page.hidden=false;renderFlow();renderComposer();flow.scrollTop=0;$('#chat-back').focus({preventScroll:true});window.scrollTo(0,0);
  }
  function attachmentMarkup(a,button=true){
    const content=(a.type==='image'&&a.src?'<img src="'+esc(a.src)+'" alt="'+esc(a.name)+'">':chatIcon(a.type==='image'?'image':'file'))
      +'<span><strong>'+esc(a.name)+'</strong><small>'+esc(a.meta??'资料')+'</small></span>';
    return button?'<button class="chat-attachment" data-attachment="'+esc(a.id)+'">'+content+'</button>':'<div class="chat-attachment">'+content+'</div>';
  }
  function chartMarkup(b){
    if(!b.chart?.length)return '';
    const values=b.chart.map(Number),lo=Math.min(...values)-50,hi=Math.max(...values)+50;
    const points=values.map((n,i)=>(8+i*260/(values.length-1||1))+','+(51-(n-lo)/(hi-lo||1)*43)).join(' ');
    return '<div class="chat-chart"><div><span>'+esc(b.chartTitle??'CO₂变化')+'</span><strong>'+esc(values.at(-1))+' <small>'+esc(b.chartUnit??'ppm')+'</small></strong></div><svg viewBox="0 0 276 62" role="img" aria-label="'+esc(values.join('、')+(b.chartUnit??'ppm'))+'"><path d="M8 54h260" stroke="#d6e2ef" fill="none"/><polyline points="'+points+'" fill="none" stroke="#4a91c9" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg><p><span>'+esc(b.chartLabels?.[0]??'调整前')+'</span><span>'+esc(b.chartLabels?.at(-1)??'最近一次')+'</span></p></div>';
  }
  function blockMarkup(b,m){
    if(b.type==='memory-actions'){
      if(b.returnToDetail)return '<div class="chat-memory-actions"><button class="chat-memory-button" data-memory-return="true">返回详情 '+icon('chevron')+'</button></div>';
      const enabled=memorySession?.memory.pendingMessageId===m.id&&!memorySession.busy;
      return '<div class="chat-memory-actions"><button class="chat-memory-button" data-reply="确认" '+(enabled?'':'disabled ')+'>确认</button><button class="chat-memory-button" data-reply="取消这次调整" '+(enabled?'':'disabled ')+'>先不调整</button></div>';
    }
    if(b.type==='device')return '<button class="chat-device" data-block="'+esc(b.id)+'" data-message="'+m.id+'"><img src="'+esc(b.image)+'" alt="'+esc(b.name)+'"><span class="chat-device-copy"><span class="chat-device-heading"><strong>'+esc(b.name)+'</strong><small>'+esc(b.status)+'</small></span><span class="chat-device-summary">'+esc(b.summary)+'</span>'+(typeof b.level==='number'?'<span class="chat-device-data"><span class="chat-meter"><i style="width:'+Math.max(0,Math.min(100,b.level))+'%"></i></span><b>'+esc(b.value)+'</b></span>':'')+'</span></button>'+chartMarkup(b);
    if(b.type==='artifact')return '<button class="chat-artifact" data-block="'+esc(b.id)+'" data-message="'+m.id+'"><span class="chat-artifact-kind">'+chatIcon(b.kind==='日程安排'?'schedule':'file')+esc(b.kind??'文稿')+'</span><strong>'+esc(b.title)+'</strong><span class="chat-artifact-summary">'+esc(b.summary)+'</span><span class="chat-artifact-footer"><span>第 '+(b.version??1)+' 版</span><span>打开查看 '+icon('chevron')+'</span></span></button>';
    if(b.type==='progress')return '<button class="chat-progress" data-block="'+esc(b.id)+'" data-message="'+m.id+'"><span class="chat-progress-heading"><strong>'+esc(b.title)+'</strong><span data-state="'+esc(b.status)+'">'+esc(b.status)+'</span></span><p>'+esc(b.summary)+'</p><ol class="chat-progress-steps">'+(b.steps??[]).slice(b.status==='已完成'?-3:-2).map(s=>'<li data-status="'+esc(s.status)+'"><i></i><span>'+esc(s.label)+'</span></li>').join('')+'</ol><span class="chat-progress-link">查看进展 '+icon('chevron')+'</span></button>';
    if(b.type==='choices')return '<div class="chat-choice"><p>'+esc(b.prompt??'')+'</p>'+b.options.map(o=>'<button '+(m.historical?'disabled ':'')+'data-reply="'+esc(o.text)+'">'+esc(o.label)+'</button>').join('')+'</div>';
    return '';
  }
  function messageMarkup(m){
    return '<article class="chat-message" data-role="'+m.role+'" data-message="'+m.id+'">'
      +(m.role==='assistant'?'<div class="chat-author"><span class="asset"><img src="assets/consciousness.svg" alt=""></span><span>小元</span><time>'+esc(m.time??'')+'</time></div>':'')
      +(m.attachments?.length?'<div class="chat-message-attachments">'+m.attachments.map(a=>attachmentMarkup(a)).join('')+'</div>':'')
      +'<p class="chat-message-text">'+esc(m.text)+'</p>'
      +'<div class="chat-processing" '+(m.processing?'':'hidden')+' role="status"><i class="chat-status-line"></i><span>'+esc(m.processing)+'</span></div>'
      +'<div class="chat-blocks">'+(m.blocks??[]).map(b=>blockMarkup(b,m)).join('')+'</div>'
      +(m.role==='assistant'?'<div class="chat-message-actions" '+(m.processing?'hidden':'')+'><button data-copy="'+m.id+'" aria-label="复制这条回应">'+chatIcon('copy')+'</button>'+(m.stopped?'<span>已停止</span>':'')+'</div>':'')+'</article>';
  }
  function updateHeader(s){
    const memory=s.kind==='memory';
    page.dataset.kind=memory?'memory':'general';
    $('#chat-new').hidden=memory;$('#chat-history').hidden=memory;$('#chat-add').hidden=memory;
    $('#chat-back').setAttribute('aria-label',memory?'返回记忆详情':'返回首页');
    input.maxLength=memory?300:2000;
    input.placeholder=memory?'告诉小元，想怎么调整':'告诉小元，你想做什么';
    const hasMessages=s.messages.length>0;
    $('#chat-title').textContent=hasMessages?s.title:'小元';
    $('#chat-title').title=hasMessages?s.title:'小元';
    $('#chat-subtitle').hidden=hasMessages;
    $('#chat-subtitle').textContent='生活与工作，一起理清';
  }
  function renderFlow(){
    const s=current();if(!s)return;
    updateHeader(s);
    if(s.kind==='memory'){
      const item=s.memory.item,state=!item.enabled?'已停用':item.expired?'已到期':'使用中';
      flow.innerHTML='<section class="chat-memory-context"><span>正在纠正这条记忆</span><p>'+esc(item.text)+'</p><small>'+(item.visibility==='family'?'家庭共享':'仅自己')+' · '+state+'</small></section>'+s.messages.map(messageMarkup).join('');
      $('#chat-new-content').hidden=true;return;
    }
    flow.innerHTML=s.messages.length?'<p class="chat-date-label">'+(s.date===day?'今天':esc(s.date))+' · 仅自己</p>'+s.messages.map(messageMarkup).join('')
      :'<section class="chat-welcome"><span class="asset chat-welcome-mark"><img src="assets/consciousness.svg" alt=""></span><h2>想做的事，和我说说</h2><p>照看家里的变化，安排日常<br>也陪你理清思路，完成手边的工作</p><div class="chat-suggestions"><button class="chat-suggestion" data-reply="家里现在有什么需要留意的？">'+icon('room')+'<span>看看家里的近况</span>'+icon('chevron')+'</button><button class="chat-suggestion" data-reply="帮我安排明天的事情">'+chatIcon('schedule')+'<span>一起安排明天</span>'+icon('chevron')+'</button><button class="chat-suggestion" data-library="true">'+chatIcon('file')+'<span>把资料整理成要点</span>'+icon('chevron')+'</button></div><button class="chat-welcome-history" id="chat-welcome-history">接着上次的会话 '+icon('chevron')+'</button></section>';
    $('#chat-welcome-history')?.addEventListener('click',openHistory);
    $('#chat-new-content').hidden=true;
  }
  function updateMessage(s,m){
    if(!visible(s))return;
    const anchor=nearBottom(),scroll=flow.scrollTop,node=flow.querySelector('[data-message="'+m.id+'"]');
    if(!node){renderFlow();}else{
      node.querySelector('.chat-message-text').textContent=m.text;
      const process=node.querySelector('.chat-processing');process.hidden=!m.processing;process.querySelector('span').textContent=m.processing??'';
      const blockHost=node.querySelector('.chat-blocks'),html=(m.blocks??[]).map(b=>blockMarkup(b,m)).join('');if(blockHost.innerHTML!==html){blockHost.innerHTML=html;if(m.resultNew)Array.from(blockHost.children).forEach(n=>n.dataset.new='true');}m.resultNew=false;
      const actions=node.querySelector('.chat-message-actions');if(actions){actions.hidden=!!m.processing;actions.innerHTML='<button data-copy="'+m.id+'" aria-label="复制这条回应">'+chatIcon('copy')+'</button>'+(m.stopped?'<span>已停止</span>':'');}
    }
    if(anchor)flow.scrollTop=flow.scrollHeight;else{flow.scrollTop=scroll;$('#chat-new-content').hidden=false;}
  }
  function renderComposer(){
    const s=current();if(!s)return;input.value=s.draft??'';
    const box=$('#chat-attachments');box.hidden=!s.attachments.length;
    box.innerHTML=s.attachments.map(a=>'<div class="chat-draft-attachment">'+attachmentMarkup(a)+'<button type="button" data-remove="'+a.id+'" aria-label="移除'+esc(a.name)+'">'+icon('close')+'</button></div>').join('');
    updateComposerAction();
    resizeInput();
  }
  function updateComposerAction(){
    const s=current(),button=$('#chat-action');if(!s)return;
    const mode=s.busy?'stop':input.value.trim()||s.attachments.length?'send':'voice';
    if(button.dataset.mode!==mode){button.dataset.mode=mode;button.innerHTML=actionIcon(mode);}
    button.setAttribute('aria-label',mode==='voice'?'语音输入':mode==='send'?'发送消息':'停止回应');
  }
  function resizeInput(){input.style.height='auto';input.style.height=Math.min(112,input.scrollHeight)+'px';}
  let historyOrigin=null,historyMenuSession=null,historyHold=null,historySuppressedId=null;
  const historyResults=$('#chat-history-results'),historySearch=$('#chat-history-search'),historyMenu=$('#chat-history-context');
  const searchKey=value=>String(value??'').normalize('NFKC').toLocaleLowerCase().trim();
  function renderHistory(){
    const query=searchKey(historySearch.value);
    const items=conversations.filter(s=>s.messages.length).filter(s=>!query||searchKey(s.title+'\n'+s.messages.map(m=>[m.text,...(m.attachments??[]).map(a=>a.name),...(m.blocks??[]).map(b=>b.body??b.summary??'')].join('\n')).join('\n')).includes(query)).sort((a,b)=>(b.updatedAt??0)-(a.updatedAt??0));
    const yesterday=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(Date.parse(day+'T12:00:00+08:00')-86400000);
    const dateGroups=new Map();
    for(const session of items){if(!dateGroups.has(session.date))dateGroups.set(session.date,[]);dateGroups.get(session.date).push(session);}
    historyResults.innerHTML=items.length?[...dateGroups].map(([date,rows])=>{
      const [year,month,dayOfMonth]=date.split('-');
      const label=date===day?'今天':date===yesterday?'昨天':year+'年'+Number(month)+'月'+Number(dayOfMonth)+'日';
      return '<section class="chat-history-group"><h2>'+esc(label)+'</h2>'+rows.map(s=>'<button class="chat-history-row" data-session="'+s.id+'" data-active="'+(s.id===activeId)+'" '+(s.id===activeId?'aria-current="page" ':'')+'title="'+esc(s.title)+'">'+esc(s.title)+'</button>').join('')+'</section>';
    }).join(''):'<p class="chat-history-empty">'+(query?'没有找到相关会话':'还没有会话记录')+'</p>';
    $('#chat-history-clear').hidden=!historySearch.value;
  }
  function openHistory(){
    saveDraft();historyOrigin=document.activeElement;hideHistoryMenu();historySearch.value='';renderHistory();historyResults.scrollTop=0;
    historyDrawer.style.setProperty('--frame-top',$('#app').getBoundingClientRect().top+'px');
    if(!historyDrawer.open)historyDrawer.showModal();$('#chat-history-close').focus({preventScroll:true});
  }
  function cancelHistoryHold(){if(historyHold)clearTimeout(historyHold.timer);historyHold=null;}
  function hideHistoryMenu(restore=false){
    const id=historyMenuSession;historyMenu.hidden=true;historyMenuSession=null;
    if(restore)historyResults.querySelector('[data-session="'+id+'"]')?.focus({preventScroll:true});
  }
  function closeHistory(restore=true){
    cancelHistoryHold();hideHistoryMenu();historySuppressedId=null;if(historyDrawer.open)historyDrawer.close();
    if(restore&&!page.hidden)(historyOrigin?.isConnected?historyOrigin:$('#chat-history')).focus({preventScroll:true});
  }
  function restoreHistoryRow(id){
    if(!historyDrawer.open)return;
    (historyResults.querySelector('[data-session="'+id+'"]')??$('#chat-history-close')).focus({preventScroll:true});
  }
  function showHistoryMenu(row){
    if(!row||!historyDrawer.open)return;
    historyMenuSession=row.dataset.session;historyMenu.hidden=false;
    const rect=row.getBoundingClientRect(),frame=historyDrawer.getBoundingClientRect();
    historyMenu.style.setProperty('--menu-x',Math.max(16,Math.min(148,rect.right-frame.left-168))+'px');
    historyMenu.style.setProperty('--menu-y',Math.max(74,Math.min(frame.height-118,rect.bottom-frame.top+4))+'px');
    historyMenu.querySelector('[role=menuitem]').focus({preventScroll:true});
  }
  function renameConversation(id){
    const s=conversations.find(n=>n.id===id);if(!s)return;
    hideHistoryMenu();
    openSheet('重命名会话','<form id="chat-rename-form" novalidate><label class="form-label" for="chat-rename-title">会话标题</label><input class="text-input" id="chat-rename-title" maxlength="40" value="'+esc(s.title)+'" autocomplete="off" aria-describedby="chat-rename-error"><p class="form-error" id="chat-rename-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary-button" id="chat-rename-cancel">取消</button><button type="submit" class="primary-button">保存</button></div></form>',{variant:'float',initialFocus:'#chat-rename-title',restoreFocus:()=>restoreHistoryRow(id)});
    $('#chat-rename-cancel').onclick=()=>$('#sheet').close();
    $('#chat-rename-title').oninput=()=>{$('#chat-rename-error').textContent='';$('#chat-rename-title').removeAttribute('aria-invalid');};
    $('#chat-rename-form').onsubmit=e=>{
      e.preventDefault();const title=$('#chat-rename-title').value.trim();
      if(!title||Array.from(title).length>40){$('#chat-rename-error').textContent=title?'标题最多40个字':'请填写会话标题';$('#chat-rename-title').setAttribute('aria-invalid','true');$('#chat-rename-title').focus();return;}
      s.title=title;if(s.id===activeId)updateHeader(s);renderHistory();$('#sheet').close();toast('会话标题已更新');
    };
  }
  function confirmDeleteConversation(id){
    const s=conversations.find(n=>n.id===id);if(!s)return;
    hideHistoryMenu();
    openSheet('删除会话','<p class="sheet-description">确定删除“'+esc(s.title)+'”？</p><p class="field-hint">已有设备操作和服务记录会保留</p><div class="dialog-actions"><button class="secondary-button" id="chat-delete-cancel">取消</button><button class="primary-button destructive-button" id="chat-delete-confirm">删除会话</button></div>',{variant:'float',restoreFocus:()=>restoreHistoryRow(id)});
    $('#chat-delete-cancel').onclick=()=>$('#sheet').close();
    $('#chat-delete-confirm').onclick=()=>{
      if(s.busy)stop(s);
      conversations.splice(conversations.findIndex(n=>n.id===id),1);
      for(const [eventId,bindings] of airBindings){const remaining=bindings.filter(b=>b.session.id!==id);if(remaining.length)airBindings.set(eventId,remaining);else airBindings.delete(eventId);}
      new Set([...s.attachments,...s.messages.flatMap(m=>m.attachments??[])].map(a=>a.src).filter(src=>src?.startsWith('blob:'))).forEach(src=>URL.revokeObjectURL(src));
      if(activeId===id){makeConversation();renderFlow();renderComposer();flow.scrollTop=0;}
      renderHistory();$('#sheet').close();toast('会话已删除');
    };
  }
  historySearch.oninput=()=>{hideHistoryMenu();renderHistory();historyResults.scrollTop=0;};
  $('#chat-history-clear').onclick=()=>{historySearch.value='';renderHistory();historySearch.focus({preventScroll:true});};
  $('#chat-history-close').onclick=()=>closeHistory();$('#chat-history-scrim').onclick=()=>closeHistory();
  historyDrawer.addEventListener('cancel',e=>{e.preventDefault();if(!historyMenu.hidden)hideHistoryMenu(true);else closeHistory();});
  historyDrawer.addEventListener('click',e=>{if(e.target===historyDrawer)closeHistory();});
  historyDrawer.addEventListener('pointerdown',e=>{if(!historyMenu.hidden&&!historyMenu.contains(e.target))hideHistoryMenu();});
  historyResults.addEventListener('pointerdown',e=>{
    const row=e.target.closest('[data-session]');if(!row||e.button!==0)return;
    cancelHistoryHold();historySuppressedId=null;historyHold={x:e.clientX,y:e.clientY,row};
    historyHold.timer=setTimeout(()=>{historySuppressedId=row.dataset.session;showHistoryMenu(row);},550);
  });
  historyResults.addEventListener('pointermove',e=>{if(historyHold&&Math.hypot(e.clientX-historyHold.x,e.clientY-historyHold.y)>8)cancelHistoryHold();},{passive:true});
  historyResults.addEventListener('pointerup',cancelHistoryHold);historyResults.addEventListener('pointercancel',cancelHistoryHold);
  historyResults.addEventListener('scroll',()=>{cancelHistoryHold();hideHistoryMenu();},{passive:true});
  historyResults.addEventListener('contextmenu',e=>{const row=e.target.closest('[data-session]');if(row){e.preventDefault();cancelHistoryHold();showHistoryMenu(row);}});
  historyResults.addEventListener('keydown',e=>{if(e.key==='ContextMenu'||e.key==='F10'&&e.shiftKey){const row=e.target.closest('[data-session]');if(row){e.preventDefault();showHistoryMenu(row);}}});
  historyResults.addEventListener('click',e=>{
    const row=e.target.closest('[data-session]');if(!row)return;
    if(e.detail!==0&&row.dataset.session===historySuppressedId){e.preventDefault();historySuppressedId=null;return;}
    hideHistoryMenu();closeHistory(false);activeId=row.dataset.session;renderFlow();renderComposer();flow.scrollTop=current().scroll??0;$('#chat-history').focus({preventScroll:true});
  });
  historyMenu.addEventListener('click',e=>{const b=e.target.closest('[data-history-action]');if(!b)return;const id=historyMenuSession;b.dataset.historyAction==='rename'?renameConversation(id):confirmDeleteConversation(id);});
  historyMenu.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const buttons=[...historyMenu.querySelectorAll('[role=menuitem]')],index=buttons.indexOf(document.activeElement);buttons[(index+(e.key==='ArrowDown'?1:buttons.length-1))%buttons.length].focus();}});
  function newConversation(){saveDraft();makeConversation();$('#chat-reader').hidden=true;renderFlow();renderComposer();flow.scrollTop=0;input.focus({preventScroll:true});}
  function openLibrary(){
    openSheet('添加资料','<div class="chat-library"><button id="chat-pick-local">'+chatIcon('plus')+'<span><strong>选择图片或文件</strong><small>图片、文本及文档</small></span>'+icon('chevron')+'</button><h3>手边的资料</h3>'+attachmentSamples.map(a=>'<button data-sample="'+a.id+'">'+(a.type==='image'?chatIcon('image'):chatIcon('file'))+'<span><strong>'+esc(a.name)+'</strong><small>'+esc(a.meta)+'</small></span>'+icon('plus')+'</button>').join('')+'</div>',{restoreFocus:()=>$('#chat-add').focus({preventScroll:true})});
    $('#sheet').dataset.content='chat-library';
    $('#chat-pick-local').onclick=()=>$('#chat-file-input').click();
    $('#sheet').querySelectorAll('[data-sample]').forEach(b=>b.onclick=()=>{addAttachment(structuredClone(attachmentSamples.find(a=>a.id===b.dataset.sample)));$('#sheet').close();});
  }
  function addAttachment(a){const s=current();if(s.attachments.length>=3){toast('一次最多添加3份资料');return false;}if(!s.attachments.some(n=>n.id===a.id))s.attachments.push(a);renderComposer();return true;}
  $('#chat-file-input').onchange=async e=>{
    const session=current();for(const f of e.target.files){
      if(f.size>10*1024*1024){toast('请选择10MB以内的文件');continue;}
      const image=f.type.startsWith('image/');
      const a={id:uid(),name:f.name,type:image?'image':'document',meta:Math.max(1,Math.round(f.size/1024))+' KB',src:image?URL.createObjectURL(f):null,content:!image&&/\.(txt|md|csv)$/i.test(f.name)?(await f.text()).slice(0,16000):null,local:true};
      if(session.id!==activeId)break;addAttachment(a);
    }e.target.value='';$('#sheet').close();
  };
  function findMessage(id){return current()?.messages.find(m=>m.id===id);}
  function allAttachments(s){return s.messages.flatMap(m=>m.attachments??[]);}
  function findArtifact(s){return s.messages.flatMap(m=>m.blocks??[]).filter(b=>b.type==='artifact').at(-1);}
  function openReader({title,meta,body,src,adjust=false,origin}){
    readerOrigin=origin??document.activeElement;readerBody=body??title;$('#chat-reader-title').textContent=title;$('#chat-reader-meta').textContent=meta??'';
    $('#chat-reader-content').innerHTML=src?'<img class="chat-reader-image" src="'+esc(src)+'" alt="'+esc(title)+'">'+(body?'<p>'+esc(body)+'</p>':''):'<div class="chat-reader-prose">'+String(body??'').split(/\n\n+/).map(part=>{const lines=part.split('\n');return lines.length>1&&lines[0].length<26?'<h3>'+esc(lines.shift())+'</h3><p>'+esc(lines.join('\n'))+'</p>':'<p>'+esc(part)+'</p>';}).join('')+'</div>';
    $('#chat-reader-use').hidden=!adjust;$('#chat-reader-copy').hidden=!!src;$('#chat-reader').hidden=false;page.querySelector(':scope > .chat-header').inert=true;$('#chat-flow').inert=true;$('.chat-composer-wrap').inert=true;$('#chat-reader-content').scrollTop=0;$('#chat-reader-back').focus({preventScroll:true});
  }
  function closeReader(){const scroll=flow.scrollTop,origin=readerOrigin;$('#chat-reader').hidden=true;page.querySelector(':scope > .chat-header').inert=false;$('#chat-flow').inert=false;$('.chat-composer-wrap').inert=false;renderFlow();renderComposer();flow.scrollTop=scroll;const restored=origin?.dataset?.block?flow.querySelector('[data-block="'+origin.dataset.block+'"][data-message="'+origin.dataset.message+'"]'):null;(restored??input).focus({preventScroll:true});}
  async function copyText(text){try{await navigator.clipboard.writeText(text);toast('已复制');}catch{toast('暂时无法复制，可以长按文字选择');}}
  function openAttachment(id,origin){
    const a=[...current().attachments,...allAttachments(current())].find(n=>n.id===id);if(!a)return;
    openReader({title:a.name,meta:a.meta,body:a.content??(a.type==='image'?'':'这份资料还没有可读取的文本'),src:a.type==='image'?a.src:null,origin});
  }
  function openBlock(m,b,origin){
    if(b.type==='artifact'){openReader({title:b.title,meta:(b.kind??'文稿')+' · 第'+(b.version??1)+'版',body:b.body,adjust:true,origin});return;}
    openSheet(b.name??b.title,'<div class="chat-detail-meta">'+esc(b.status)+'</div><p class="experience-detail-summary">'+esc(b.detail??b.summary)+'</p>'
      +(b.type==='device'?'<div class="chat-detail-device"><img src="'+esc(b.image)+'" alt="'+esc(b.name)+'"><span>'+esc(b.metricLabel??'设备反馈')+'<strong>'+esc(b.value??b.status)+'</strong></span></div>'+chartMarkup(b):'<ol class="chat-detail-steps">'+(b.steps??[]).map(s=>'<li data-status="'+s.status+'"><strong>'+esc(s.label)+'</strong><p>'+esc(s.detail)+'</p></li>').join('')+'</ol>')
      +(b.type==='progress'&&['持续观察','等待资料','正在推进'].includes(b.status)&&!m.historical?'<div class="dialog-actions"><button class="secondary-button" id="chat-cancel-task">结束这次关注</button></div>':''),{restoreFocus:()=>origin?.focus({preventScroll:true})});
    $('#sheet').dataset.content='chat-detail';
    $('#chat-cancel-task')?.addEventListener('click',()=>{
      const s=current();if(!['持续观察','等待资料','正在推进'].includes(b.status)){$('#sheet').close();toast('这件事已经结束');return;}if(b.service){cancelAir?.(b.id);$('#sheet').close();toast('这次关注已结束');return;}b.status='已结束';b.summary='这次关注已结束，已有记录会保留';clearTimeout(b.taskTimer);delete b.taskTimer;updateMessage(s,m);
      writeRecord({experienceId:b.id,title:b.title,summary:b.summary,status:'已结束',state:'past',scope:'family',label:'结束关注',text:b.summary});$('#sheet').close();toast('这次关注已结束');
    });
  }
  function append(s,m){s.messages.push(m);s.time=clock();s.date=day;s.updatedAt=previewNow();if(visible(s)){const scroll=flow.scrollTop,follow=nearBottom();if(s.messages.length===1)flow.innerHTML='<p class="chat-date-label">今天 · 仅自己</p>';flow.insertAdjacentHTML('beforeend',messageMarkup(m));flow.lastElementChild.dataset.new='true';updateHeader(s);renderComposer();flow.scrollTop=follow?flow.scrollHeight:scroll;if(!follow)$('#chat-new-content').hidden=false;}}
  function wait(run,ms){return new Promise(resolve=>{const timer=setTimeout(()=>{run.timers.delete(timer);resolve(!run.stopped);},ms);run.timers.set(timer,resolve);});}
  function stop(s=current()){
    if(s?.kind==='memory'){s.memory.pending=null;s.memory.pendingMessageId=null;}
    const run=s?.busy;if(!run)return;run.stopped=true;
    for(const [timer,resolve] of run.timers){clearTimeout(timer);resolve(false);}run.timers.clear();
    run.message.processing=null;run.message.stopped=true;run.message.text=run.message.text||'先停在这里，你可以补充或重新调整';
    if(run.pendingDevice){run.message.blocks=[];writeRecord({experienceId:run.message.id,title:run.lampTitle??'客厅灯光的这次调整',summary:'已停止等待，设备结果尚未确认',status:'未确认',scope:'family',label:'停止等待反馈',text:'不把已发送的调整请求当成已完成'});}
    s.busy=null;updateMessage(s,run.message);if(visible(s))renderComposer();
  }
  async function stream(s,run,text){
    if(run.stopped)throw new DOMException('Stopped','AbortError');run.message.processing=null;const chars=Array.from(clean(text));run.message.text='';
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){run.message.text=chars.join('');updateMessage(s,run.message);return true;}
    for(let i=0;i<chars.length;i+=5){if(run.stopped)throw new DOMException('Stopped','AbortError');run.message.text=chars.slice(0,i+5).join('');updateMessage(s,run.message);if(!await wait(run,26))throw new DOMException('Stopped','AbortError');}return true;
  }
  function finish(s,run,blocks=[]){if(run.stopped)return;run.message.processing=null;run.message.blocks=blocks;run.message.resultNew=true;s.busy=null;updateMessage(s,run.message);if(visible(s))renderComposer();}
  function memorySummary(plan){
    const parts=plan.changes.map(change=>change.label==='记忆内容'?'把这条记忆改为“'+change.after+'”':change.label==='适用时间'?'把适用时间改为'+change.after:change.label==='适用空间'?'把适用空间改为'+change.after:change.label==='使用状态'?(plan.enabled?'恢复使用这条记忆':'暂时不再使用这条记忆'):'把这条理解标为已明确');
    if(!plan.next.enabled&&!plan.changes.some(change=>change.label==='使用状态'))parts.push('继续保持停用');
    return '我会'+parts.join('；')+'。这样调整可以吗？';
  }
  async function replyMemory(s,text){
    const memory=s.memory,pending=memory.pending;
    memory.pending=null;memory.pendingMessageId=null;
    const m={id:uid(),role:'assistant',text:'',time:clock(),processing:'正在理解你的意思',blocks:[]};
    const run={message:m,timers:new Map(),stopped:false};s.busy=run;renderFlow();append(s,m);
    if(!await wait(run,650)||memorySession!==s)return;
    const instruction=String(text).trim().replace(/[。！!？?]+$/u,'');
    if(/^(?:取消|先不改|先不调整|不改了|算了|取消这次调整|不用改了)$/u.test(instruction)){
      await stream(s,run,'好，先不调整，详情里的内容保持原样');finish(s,run);return;
    }
    if(/^(?:确认|可以|是的|就这样|好的|好|没问题|确认[，,]?就这样|可以[，,]?就这样)$/u.test(instruction)){
      if(!pending){await stream(s,run,'还没有待确认的调整。你想把这条记忆改成什么？');finish(s,run);return;}
      await stream(s,run,'好，我来按刚才的理解调整');
      if(run.stopped||memorySession!==s)return;
      const next=memory.onConfirm?.(pending);
      if(next===false||!memory.onConfirm){m.text='这次还没有填入详情，你可以返回检查后再试';finish(s,run);return;}
      memory.item=structuredClone(next&&typeof next==='object'?next:pending.next);
      if(pending.patch.text!==undefined||pending.patch.confirmUnderstanding)memory.item.understanding='clear';
      m.text='已填入详情，保存后生效';renderFlow();finish(s,run,[{type:'memory-actions',returnToDetail:true}]);return;
    }
    const normalized=instruction.replace(/^(?:不对|不是|不|等等)[，,：:]\s*/u,'');
    const plan=parseMemoryInstruction(normalized,memory.item,{today:memory.today,rooms:getRooms()});
    if(!plan.ok){await stream(s,run,plan.message);finish(s,run);return;}
    await stream(s,run,memorySummary(plan));
    if(run.stopped||memorySession!==s)return;
    memory.pending=plan;memory.pendingMessageId=m.id;
    finish(s,run,[{type:'memory-actions'}]);
  }
  async function reply(s,text,files){
    const m={id:uid(),role:'assistant',text:'',time:clock(),processing:files.length?'正在读取资料':'正在理解你的请求',blocks:[]};
    const run={message:m,timers:new Map(),stopped:false};s.busy=run;append(s,m);
    if(!await wait(run,650))return;
    if(/^再试(一次)?[。！]?$/u.test(text)){const prior=s.messages.filter(n=>n.role==='user').at(-2);if(prior&&/灯/.test(prior.text))text=prior.text;}
    const hasLamp=/灯|亮度|暗一点|亮一点/.test(text),lastArtifact=findArtifact(s);
    const work=/汇报|材料|资料|文稿|要点|摘要|总结|工作|方案/.test(text);
    const docs=[...files,...allAttachments(s)].filter(a=>a.type==='document');
    if(hasLamp){
      const requestedRooms=getRooms().filter(r=>text.includes(r.name));
      if(requestedRooms.some(r=>r.id!=='living')||(!requestedRooms.some(r=>r.id==='living')&&/主卧|次卧|厨房|餐厅|卫生间|卧室|书房|儿童房|阳台/.test(text))){await stream(s,run,'这个空间的灯具还没有确认可用的控制连接，暂时不能替你调整。可以先查看设备连接，或明确要操作客厅主灯');finish(s,run);return;}
      const living=getRooms().find(r=>r.id==='living');
      if(!living){await stream(s,run,'客厅空间已经移除，先确认灯具现在属于哪个空间');finish(s,run);return;}
      const lamp=getLampDevice?.();
      const available=device=>device&&device.roomId==='living'&&device.online&&device.permissions?.control&&!device.pending;
      if(getLampDevice&&!available(lamp)){await stream(s,run,'这个空间的灯具连接或归属发生了变化，先确认设备的位置和连接，再继续调整');finish(s,run);return;}
      const lampName=lamp?.name??'客厅主灯';
      run.lampTitle=`${living.name}灯光的这次调整`;
      const previous=getLampLevel?.()??60;
      const percent=text.match(/(\d{1,3})\s*[%％]/)?.[1];
      const target=percent!==undefined?Number(percent):/关灯|关闭/.test(text)?0:/暗一点|柔和|太亮|有点亮/.test(text)?Math.max(0,previous-10):/亮一点/.test(text)?Math.min(100,previous+10):60;
      if(target<0||target>100){await stream(s,run,'亮度可以在0%到100%之间调整，你希望调到多少？');finish(s,run);return;}
      run.pendingDevice=true;writeRecord({experienceId:m.id,title:run.lampTitle,summary:'已发出亮度调整请求，正在等待设备反馈',status:'等待设备反馈',state:'active',scope:'family',label:'发出调整请求',text:'将'+lampName+'调至'+target+'%，结果待确认'});
      if(!await stream(s,run,'我来调整'+lampName+'，等设备回应'))return;m.processing='等待设备反馈';updateMessage(s,m);
      if(!await wait(run,1200))return;
      const confirmedLamp=getLampDevice?.();
      if(!getRooms().some(r=>r.id==='living')||(getLampDevice&&!available(confirmedLamp))){run.pendingDevice=false;m.text='设备连接或空间归属发生了变化，这次调整的结果还没有确认';finish(s,run);writeRecord({experienceId:m.id,title:run.lampTitle,summary:m.text,status:'未确认',state:'past',scope:'family',label:'结果未确认',text:m.text});return;}
      const confirmedName=confirmedLamp?.name??lampName;
      const result=confirmedName+'已反馈，亮度调至'+target+'%';m.text=result;run.pendingDevice=false;
      const device={type:'device',id:uid(),name:confirmedName,image:confirmedLamp?.image??'assets/receipt-lamp.png',summary:target===0?'灯光已关闭':'光线已经调好，你可以继续微调',status:'已反馈',value:target+'%',metricLabel:'亮度',level:target,detail:result+'，这次结果来自设备状态反馈'};
      onDevice?.({deviceId:confirmedLamp?.id,percentage:target,summary:result});
      writeRecord({experienceId:m.id,title:run.lampTitle,summary:result,status:'已反馈',state:'past',scope:'family',tone:'good',label:'设备回应',text:result});finish(s,run,[device]);return;
    }
    if(/停止|先停|结束/.test(text)&&/换气|空气|关注/.test(text)){
      const binding=[...airBindings.values()].flat().filter(b=>b.session.id===s.id&&['持续观察','正在推进'].includes(b.block.status)).at(-1);
      if(binding){cancelAir?.(binding.block.id);await stream(s,run,'这次换气关注已经结束，已发生的过程会保留');finish(s,run);return;}
    }
    if(/闷|换气|通风|改善空气/.test(text)&&!/怎么样|为什么|如何|情况/.test(text)){
      const requestedRooms=getRooms().filter(r=>text.includes(r.name));
      if(requestedRooms.some(r=>r.id!=='living')||(!requestedRooms.some(r=>r.id==='living')&&/主卧|次卧|厨房|餐厅|卫生间|卧室|书房|儿童房|阳台/.test(text))){await stream(s,run,'这个空间还没有接上可用的换气能力，可以先查看设备连接，或明确要调整客厅');finish(s,run);return;}
      if(!getRooms().some(r=>r.id==='living')){await stream(s,run,'客厅空间已经移除，先确认设备归属，再继续调整');finish(s,run);return;}
      await stream(s,run,'我会用低噪方式换气，再留意客厅空气的变化');
      const event=startAir?.();if(!event){m.text='暂时还无法启动换气，可以先查看设备连接';finish(s,run);return;}
      const block={type:'progress',id:event.id,service:true,title:'客厅空气的这次变化',status:'正在推进',summary:'已开始处理，设备和环境结果会分别确认',steps:[]};
      const bindings=airBindings.get(event.id)??[];bindings.push({session:s,message:m,block});airBindings.set(event.id,bindings);finish(s,run,[block]);updateAir(event);return;
    }
    if(/留意|持续观察|盯着/.test(text)&&/空气|环境|变化/.test(text)){
      const requestedRooms=getRooms().filter(r=>text.includes(r.name));
      if(requestedRooms.some(r=>r.id!=='living')||(!requestedRooms.some(r=>r.id==='living')&&/主卧|次卧|厨房|餐厅|卫生间|卧室|书房|儿童房|阳台/.test(text))){await stream(s,run,'这个空间的环境感知还需要确认，暂时不创建持续观察。可以先查看空间近况');finish(s,run);return;}
      const task={type:'progress',id:'chat-observe-'+uid(),title:'客厅空气的变化',status:'持续观察',summary:'我会接着看环境读数，变化明确后再告诉你',steps:[{label:'开始观察',detail:'继续读取客厅环境传感器的反馈',status:'done'},{label:'留意后续变化',detail:'还需要新的读数，暂时不判断空气已经改善',status:'active'}]};
      await stream(s,run,'我会继续留意客厅空气，有明确变化再告诉你');finish(s,run,[task]);
      writeRecord({experienceId:task.id,title:task.title,summary:task.summary,status:task.status,state:'active',scope:'family',label:'开始持续观察',text:task.summary});return;
    }
    if(/空气|通风|闷/.test(text)){
      const rooms=getRooms(),room=rooms.find(r=>text.includes(r.name))??rooms.find(r=>r.id==='living');
      await stream(s,run,room?(room.observed?room.name+'目前'+room.environment+'。我会区分设备状态和环境结果，变化明确后再告诉你':room.name+'的环境感知还在等待更新，目前不能确认空气情况'):'这个空间还没有可用的当前环境信息');finish(s,run);return;
    }
    if(/家里|家庭|近况|需要留意/.test(text)){
      const rooms=getRooms(),observed=rooms.filter(r=>r.observed);
      await stream(s,run,observed.map(r=>r.name+'：'+r.presence+'，'+r.environment).join('\n')+'\n其余空间还在等待感知更新，我不会把缺少数据当作一切正常');finish(s,run);return;
    }
    if(lastArtifact&&/简短|精简|短一点|压缩|分钟|改成|调整/.test(text)){
      const short=/简短|精简|短一点|一分钟|两分钟|2分钟/.test(text),a={...lastArtifact,version:(lastArtifact.version??1)+1};
      if(lastArtifact.kind==='日程安排'){
        a.title='明天的安排 · 调整后';a.summary='保留固定事项，接上你刚才的调整';
        a.body=short?lastArtifact.body.split('\n').filter(line=>line.trim()&&(/\d|客户|孩子|路程|通勤/.test(line))).join('\n')+'\n\n仍可继续调整':lastArtifact.body+'\n\n这次补充\n'+text;
      }else{
        a.title=short?'汇报重点 · 精简版':'明天的汇报 · 三分钟稿';a.kind=short?'资料摘要':'汇报稿';
        a.summary=short?'保留核心进展、当前问题和下一步':'按进展、待确认事项和下一步组织';
        const source=docs.at(-1)?.content??lastArtifact.body;
        a.body=short?source.split('\n\n').filter(Boolean).slice(0,4).map(part=>part.slice(0,150)).join('\n\n')+'\n\n待确认事项继续保留':
          '开场\n今天同步方案的阶段进展，以及接下来需要确认的重点\n\n资料里的重点\n'+source+'\n\n下一步\n先完成评审和条件确认，再确定实施安排';
      }
      await stream(s,run,lastArtifact.kind==='日程安排'?'我把安排接着调整了，固定事项和需要留出的时间保留下来':short?'我把内容收紧了，保留最需要讲清的部分':'我按三分钟的节奏重新组织了，重点和待确认事项都保留下来');finish(s,run,[a]);
      writeRecord({experienceId:'chat-artifact-'+a.id,title:a.title,summary:a.summary,status:'已更新',state:'past',label:lastArtifact.kind==='日程安排'?'安排已更新':'文稿已更新',text:a.title+'，第'+a.version+'版',scope:'personal'});return;
    }
    if(files.some(a=>a.type==='image')&&!work){
      await stream(s,run,'图片收到了。你想让我关注画面里的哪一部分？');
      finish(s,run,[{type:'choices',id:uid(),options:[{label:'帮我描述画面',text:'帮我描述这张图片'},{label:'梳理相关问题',text:'根据这张图片，帮我梳理要确认的问题'}]}]);return;
    }
    if(/这张图片|画面/.test(text)&&allAttachments(s).some(a=>a.type==='image')){
      const a=allAttachments(s).filter(a=>a.type==='image').at(-1);
      await stream(s,run,a.local?'我收到这张图片了。当前还没有可读取的图像信息，你可以补充想讨论的细节':'这张布局图包含客厅、主卧、次卧、卫生间、厨房和餐厅，可以围绕空间用途和设备归属继续讨论。布局图本身不能确认实时人员或设备状态');finish(s,run);return;
    }
    if(/安排|日程|计划|见客户|接孩子/.test(text)||docs.at(-1)?.id==='sample-schedule'){
      const source=/\d|上午|下午|晚上/.test(text)?text:docs.at(-1)?.content??'';
      if(!source){await stream(s,run,'先告诉我已经确定的时间，还有哪些事情必须安排进去，我帮你看看顺序和冲突');finish(s,run,[{type:'choices',id:uid(),options:[{label:'上午见客户，下午接孩子',text:'明天上午10点见客户，下午5点接孩子，中间留时间处理工作'}]}]);return;}
      const a={type:'artifact',id:uid(),title:'明天的安排',kind:'日程安排',summary:'固定事项优先，工作与路程留出余量',version:1,body:'已经确定的事情\n'+source+'\n\n建议安排\n客户会面前预留准备和路程时间\n会面后集中处理需要延续的工作\n接孩子前留出通勤余量\n\n还需要确认\n会面地点与预计时长，决定中间可用时间\n\n这份安排可以继续调整'};
      await stream(s,run,'我先把固定事项放进去，路程和弹性时间留出余量');finish(s,run,[a]);writeRecord({experienceId:'chat-artifact-'+a.id,title:a.title,summary:a.summary,status:'已整理',state:'past',label:'日程草案已整理',text:'已形成一份可继续调整的安排，尚未写入日历或创建提醒',scope:'personal'});return;
    }
    if(work||docs.length){
      const doc=docs.at(-1);
      if(!doc){await stream(s,run,'把资料发给我，或先说说要解决的问题。你希望整理成要点，还是一份可以直接讲的稿子？');finish(s,run,[{type:'choices',id:uid(),options:[{label:'整理成要点',text:'我想先整理成要点'},{label:'准备汇报稿',text:'我想准备一份汇报稿'}]}]);return;}
      if(!doc.content){await stream(s,run,'文件收到了，但目前还没有可读取的正文。可以补充文本内容，我再帮你整理');finish(s,run);return;}
      const a={type:'artifact',id:uid(),title:'这份资料的重点',kind:'资料摘要',summary:'核心内容、待确认问题与下一步，分开整理',version:1,
        body:'资料重点\n'+doc.content.slice(0,1100)+'\n\n需要确认\n以上内容来自你提供的资料，涉及执行状态和正式时间的部分需要进一步核实\n\n下一步\n可以继续整理成汇报稿，或按你关注的问题展开'};
      await stream(s,run,'我先把资料里的重点整理出来，待确认的部分单独保留');
      finish(s,run,[a,{type:'choices',id:uid(),options:[{label:'整理成三分钟汇报',text:'整理成三分钟汇报稿'},{label:'再简短些',text:'再简短些'}]}]);
      writeRecord({experienceId:'chat-artifact-'+a.id,title:'一起整理了这份资料',summary:doc.name+'已整理成要点，待确认部分单独保留',status:'已整理',state:'past',label:'资料重点已整理',text:doc.name+'已整理成要点，待确认部分单独保留',scope:'personal'});return;
    }
    await stream(s,run,'可以，我们一起理清。你现在最想解决的问题是什么，或者希望最后得到什么结果？');finish(s,run);
  }
  function submit(text=input.value){
    text=String(text).trim();const s=current();if(!text&&!s.attachments.length){toast('先告诉我你想做什么');return;}
    if(s.busy)stop(s);
    const files=structuredClone(s.attachments);s.attachments=[];s.draft='';input.value='';
    if(!s.messages.length)s.title=clean(text||files[0].name).slice(0,20);
    append(s,{id:uid(),role:'user',text:text||'帮我看看这份资料',attachments:files,time:clock()});
    (s.kind==='memory'?replyMemory(s,text):reply(s,text||'把资料整理成要点',files)).catch(error=>{if(error.name==='AbortError')return;const run=s.busy;if(!run)return;run.message.text='这次处理没有完成，你可以重新发送';finish(s,run);});
  }
  function openVoice(){
    saveDraft();voiceText='';voiceDraft=input.value;voiceVersion++;$('#chat-voice-transcript').textContent='';$('#chat-voice-caption').textContent='正在听，点击下方结束';
    const s=current(),samples=s?.kind==='memory'?(s.memory.pending?['确认，就这样',...memoryCorrectionSamples(s.memory.item).slice(0,2)]:memoryCorrectionSamples(s.memory.item)):['把客厅灯调到60%','帮我安排明天的事情','把这份资料整理成要点'];
    $('#chat-voice-samples').innerHTML='<span>也可以这样说</span>'+samples.map(text=>'<button data-utterance="'+esc(text)+'">'+esc(text)+'</button>').join('');
    voice.dataset.phase='listening';voice.style.setProperty('--frame-top',$('#app').getBoundingClientRect().top+'px');voice.showModal();$('#chat-voice-end').focus({preventScroll:true});
  }
  function cancelVoice(){voiceVersion++;clearTimeout(voiceTimer);voice.close();input.value=voiceDraft;current().draft=voiceDraft;renderComposer();$('#chat-action').focus({preventScroll:true});}
  function endVoice(){
    if(!voiceText.trim()){$('#chat-voice-caption').textContent='还没听到内容，可以再说一次';return;}
    voiceVersion++;clearTimeout(voiceTimer);voice.close();current().draft=[voiceDraft,voiceText].filter(Boolean).join(' ');renderComposer();input.focus({preventScroll:true});toast('已转成文字，可以修改后发送');
  }
  voice.addEventListener('click',e=>{const b=e.target.closest('[data-utterance]');if(!b)return;
    const version=++voiceVersion;clearTimeout(voiceTimer);voiceText=b.dataset.utterance;const chars=Array.from(voiceText);let i=0;
    const reveal=()=>{if(version!==voiceVersion||!voice.open)return;$('#chat-voice-transcript').textContent=chars.slice(0,i+=2).join('');if(i<chars.length)voiceTimer=setTimeout(reveal,55);};reveal();
    $('#chat-voice-caption').textContent='点击下方结束，转成文字';
  });
  voice.addEventListener('cancel',e=>{e.preventDefault();cancelVoice();});
  voice.addEventListener('click',e=>{if(e.target===voice||e.target.classList.contains('chat-voice-surface'))cancelVoice();});
  $('#chat-voice-cancel').onclick=cancelVoice;$('#chat-voice-end').onclick=endVoice;
  $('#chat-back').onclick=back;$('#chat-new').onclick=newConversation;$('#chat-history').onclick=openHistory;$('#chat-add').onclick=openLibrary;$('#chat-action').onclick=()=>{const mode=$('#chat-action').dataset.mode;if(mode==='voice')openVoice();else if(mode==='stop')stop();else submit();};
  $('#chat-form').onsubmit=e=>{e.preventDefault();submit();};
  input.oninput=()=>{current().draft=input.value;updateComposerAction();resizeInput();};
  input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();submit();}};
  page.addEventListener('click',e=>{
    const button=e.target.closest('button');if(!button)return;
    if(button.dataset.memoryReturn){back();return;}
    if(button.dataset.reply){submit(button.dataset.reply);return;}
    if(button.dataset.library){current().draft='把这份资料整理成要点';renderComposer();openLibrary();return;}
    if(button.dataset.remove){current().attachments=current().attachments.filter(a=>a.id!==button.dataset.remove);renderComposer();return;}
    if(button.dataset.attachment){openAttachment(button.dataset.attachment,button);return;}
    if(button.dataset.copy){const m=findMessage(button.dataset.copy);copyText(m.text);return;}
    if(button.dataset.block){const m=findMessage(button.dataset.message),b=m?.blocks?.find(n=>n.id===button.dataset.block);if(b)openBlock(m,b,button);}
  });
  flow.addEventListener('scroll',()=>{if(current())current().scroll=flow.scrollTop;if(nearBottom())$('#chat-new-content').hidden=true;},{passive:true});
  $('#chat-new-content').onclick=()=>{flow.scrollTop=flow.scrollHeight;$('#chat-new-content').hidden=true;};
  $('#chat-reader-back').onclick=closeReader;$('#chat-reader-copy').onclick=()=>copyText(readerBody);$('#chat-reader-use').onclick=()=>{closeReader();current().draft='再简短些';renderComposer();input.focus({preventScroll:true});};
  function updateAir(event){
    const bindings=airBindings.get(event?.id);if(!bindings)return;
    for(const binding of bindings){
      const {session,message,block}=binding;
      block.status=event.cancelled?'已结束':event.failed?'未完成':event.ended?'已完成':event.stage>=3?'持续观察':'正在推进';
      block.summary=event.cancelled?'已结束这次关注，环境结果尚未确认':event.failed?'设备还没有回应，空气结果尚未达成':event.ended?'低噪换气后，环境读数已回稳':event.stage>=3?'新风已回应，继续确认空气变化':'正在准备低噪换气，等待设备回应';
      block.steps=(event.history??[]).map((entry,index)=>({label:entry.line,detail:entry.detail,status:event.failed&&index===event.history.length-1?'waiting':'done'}));
      if(!event.ended)block.steps.push({label:event.stage<3?'等待设备回应':'观察后续变化',detail:event.stage<3?'设备反馈前不判断操作成功':'环境回稳前继续观察',status:'active'});
      message.blocks=[block];
      if(event.ended&&!event.failed&&!event.cancelled){
        message.text='客厅空气回稳了，CO₂已降至790 ppm，换气和后续观察都已完成';
        message.blocks.push({type:'device',id:event.id+'-result',name:'客厅新风',image:'assets/air-device.png',status:'已反馈',summary:'低噪运行，环境传感器确认CO₂回落',value:'790 ppm',detail:'设备确认低噪运行，客厅CO₂从1150 ppm回落至790 ppm',metricLabel:'CO₂',chart:[1150,1080,1000,900,835,790],chartLabels:['调整前','最近一次'],chartUnit:'ppm'});
        message.resultNew=true;
      }
      updateMessage(session,message);
    }
  }
  return {open,openService,openMemoryCorrection,back,updateAir,onViewChange:()=>{page.hidden=$('#app').dataset.view!=='chat';if(page.hidden){saveDraft();if(voice.open)cancelVoice();if(historyDrawer.open)closeHistory(false);if(memorySession)discardMemory();}}};
}
