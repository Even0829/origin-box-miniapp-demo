import {previewNow} from './preview-clock.js';
import {createCareRestoration} from './care-restoration.js?v=care-card-actions-20261021';
import {createEventAdjustment} from './event-adjustment.js?v=event-adjustment-20261022';

const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const clean=value=>String(value??'').replace(/[。．.]+$/u,'');
const formatTime=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false});
const formatDate=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'});
const stamp=value=>Number.isFinite(Number(value))&&Number(value)>0?Number(value):null;
const dateKey=value=>formatDate.format(value);
const timeText=value=>stamp(value)?formatTime.format(Number(value)):'时间待更新';
const dayText=value=>!stamp(value)?'时间待更新':dateKey(value)===dateKey(previewNow())?'今天':dateKey(value)===dateKey(previewNow()-86400000)?'昨天':dateKey(value).replaceAll('/','年').replace(/年(\d{2})年(\d{2})$/u,'年$1月$2日');
const moment=value=>stamp(value)?`${dayText(value)} ${timeText(value)}`:'时间待更新';
const list=value=>Array.isArray(value)?value:value instanceof Map?[...value.values()]:[];
const excludedLegacyServices=new Set(['quiet-thought','quiet-discussion','space-outline','work-discussion']);
const legacyServiceIds=new Set(['quiet-air','evening-light','kitchen-light','bedroom-soft-light','work-discussion']);
const managementKinds=new Set(['thought','reflection','association','space-setup','space-management','room-management','family-management','scenario-lifecycle','scenario','mode','device-management','device-onboarding','account-management','people-management','memory-management','settings']);
const concreteLabels=new Set(['设备状态反馈','设备反馈已齐','发出调整请求','设备回应','结果未确认','停止等待反馈','日程草案已整理','安排已更新','文稿已更新','资料重点已整理','连接恢复']);

// Only concrete services and device executions enter the care feed.
// Scene lifecycle, memory and conversational bookkeeping remain in full records.
function qualifiesForCare(item,rows){
  const origin=typeof item.source==='object'?item.source?.type:item.source;
  if(excludedLegacyServices.has(item.id)||[item.kind,origin,item.origin].some(value=>managementKinds.has(value))||/^devices-added-/u.test(item.id))return false;
  if(item.careEvent===true||legacyServiceIds.has(item.id))return true;
  if(item.kind==='artifact'||/^(?:chat-artifact-|chat-observe-|air-event-)/u.test(item.id))return true;
  if(['device-control','device-feedback','connection'].includes(item.kind)&&(item.deviceId||item.deviceIds?.length))return true;
  if(['service','event','task'].includes(item.kind)&&(item.deviceIds?.length||item.steps?.some(step=>step.deviceId||['completed','failed'].includes(step.state))))return true;
  return [item.label,...rows.map(row=>row.label)].some(label=>concreteLabels.has(label));
}

// These notes describe the existing shared records. They never create an action,
// a second history stream, or an unconfirmed device result.
const seedNotes={
  'evening-light':{
    displayTitle:'客厅灯光已调暗',image:'assets/home-card-lamp.png',picture:'lamp',deviceIds:['living-lamp'],
    restoreChanges:[{deviceId:'living-lamp',roomId:'living',before:{level:60},after:{level:35},guard:{power:true},expectedRevision:0}],
    reason:'你希望看电视时灯光柔和一些。这次只调低客厅主灯，保留其他空间的照明',
    evidence:[{source:'你对本次用灯的要求',value:'“看电视时，把客厅灯调柔和一点”',label:'用户要求',match:'收到用灯要求'},{source:'客厅主灯反馈',value:'亮度已从60%调至35%',label:'设备反馈',match:'灯光调整已确认'}],
    next:'本次灯光调整已完成；可以直接调整当前亮度，也可以补充这次照料哪里不合适'
  },
  'quiet-air':{
    displayTitle:'客厅净化已切至低噪',image:'assets/device-air.png',deviceIds:['living-air'],
    restoreChanges:[{deviceId:'living-air',roomId:'living',before:{mode:'标准'},after:{mode:'低噪'},guard:{power:true},expectedRevision:0}],
    reason:'你希望休息时少一些设备噪声。按这次要求切换净化模式，保留净化运行',
    evidence:[{source:'你的休息安排',value:'“净化继续开着，声音小一点”',label:'用户要求',match:'收到低噪要求'},{source:'空气置地机反馈',value:'设备由标准切至低噪模式，尚不据此判断空气质量变化',label:'设备反馈',match:'低噪模式已确认'}],
    next:'可以按当前需要切换设备模式；设备运行反馈与空气改善结果分别确认'
  },
  'kitchen-light':{
    displayTitle:'厨房辅助灯已关闭',image:'assets/device-pendant.png',deviceIds:['kitchen-plug'],cardAction:'correct',
    restoreChanges:[{deviceId:'kitchen-plug',roomId:'kitchen',before:{power:true},after:{power:false},expectedRevision:0}],
    reason:'这次离家安排只收起厨房辅助灯，家人正在使用的其他空间和持续感知保留',
    evidence:[{source:'你的离家安排',value:'收起厨房辅助照明，其他空间照常',label:'本次要求',match:'本次离家安排'},{source:'厨房辅助灯反馈',value:'已关闭，保留原亮度设定45%',label:'设备反馈',match:'关闭反馈已确认'}],
    next:'如果本次范围理解有误，可以纠正；要立即改变灯光，可从相关设备调整'
  },
  'bedroom-soft-light':{
    displayTitle:'主卧床头灯已调柔',image:'assets/lamp-device.png',deviceIds:['master-left'],
    reason:'按你的床头阅读安排，只将左侧灯调至30%，右侧灯保留家人当前使用的亮度',
    evidence:[{source:'你的床头用灯要求',value:'左侧柔和一些，右侧暂时保持',label:'用户要求',match:'收到床头用灯要求'},{source:'主卧左灯反馈',value:'亮度30%，右侧灯未被本次操作改变',label:'设备反馈',match:'床头灯调整已确认'}],
    next:'可以直接调整左侧床头灯；本次设置不会被自动写成长期偏好'
  },
  'work-discussion':{
    displayTitle:'方案重点已梳理，等待两份资料',
    reason:'先把方案的核心问题和待补资料分开，保留已经确定的部分，避免把缺失资料里的内容当成结论',
    evidence:[{source:'你的工作委托',value:'先梳理核心问题，两份资料稍后补充',label:'用户要求',match:'接着昨天的方案'}],
    next:'补齐资料后，可以在与小元的原会话中继续整理',converse:'继续整理之前的方案'
  }
};

/** A read-only projection of the shared service and record stream. */
export function createHomeServices({container,listPage,source,getDevices=()=>[],getRooms=()=>[],getControls=()=>[],openSheet,toast,icon,setView,onBack,onDeviceDetail,onConverse,onRecord,onRestoreControl,onEventControl}){
  const document=container.ownerDocument;
  const sheet=document.querySelector('#sheet');
  const supplements=new Map();
  const signatures=new WeakMap();
  const detailPositions=new Map();
  let order=[],filter='all',view='home',listScroll=0,detailId=null,detailFromRecords=false,detailRestore=null;
  let recordsScroll=0,recordsFocusId=null,adjustmentContext=null,adjustmentNotice='';
  const e=escapeHTML;
  const chevron='<span class="hs-chevron"><img src="assets/home-chevron.svg" alt=""></span>';
  const glyph=name=>icon?.(name)??'';
  const query=selector=>listPage.querySelector(selector);
  const read=()=>source?.()??{};
  const records=()=>list(read().records).filter(row=>row&&String(row.text??row.summary??row.label??'').trim());
  const entriesFor=id=>records().filter(row=>row.experienceId===id||row.serviceId===id).sort((a,b)=>(stamp(a.at)??0)-(stamp(b.at)??0));
  const devices=()=>list(getDevices?.());
  const restorations=createCareRestoration({getDevices:devices,requestControl:onRestoreControl,onRecord:data=>onRecord?.(data),onChange:()=>refresh()});
  const eventAdjustment=createEventAdjustment({sheet,openSheet,getDevices:devices,getControls,requestControl:onEventControl,toast,onRecord:data=>onRecord?.(data),onUpdate:data=>{supplements.set(data.id,{...supplements.get(data.id),...data});refresh();}});
  const isEvent=item=>item.operationKind==='event';
  const roomName=id=>list(getRooms?.()).find(room=>room.id===id)?.name??'未设置空间';
  const isActive=item=>item.kind==='scenario'?['running','active','partial'].includes(item.state):item.state==='active'||/进行中|推进中|观察|等待|待处理|部分|未完成|未确认|暂停|执行中/u.test(item.status??'');
  const statusText=item=>item.status||(isActive(item)?'进行中':'已记录');
  const tone=item=>/失败|未完成|未确认|部分|受阻|待处理/u.test(statusText(item))?'waiting':/已完成|已验证|已反馈|已整理/u.test(statusText(item))?'done':'neutral';

  function services(){
    const shared=list(read().services).filter(item=>item?.id);
    const unique=new Map();
    for(const original of shared){
      const notes=seedNotes[original.id]??{},extra=supplements.get(original.id)??{};
      const item={...notes,...original,...extra};
      if(!qualifiesForCare(item,entriesFor(item.id)))continue;
      item.title=clean(extra.title??notes.displayTitle??original.title);
      item.summary=clean(extra.summary??notes.displaySummary??original.summary);
      item.at=stamp(extra.at??extra.updatedAt??original.updatedAt??original.at);
      item.scope=original.scope==='personal'||extra.scope==='personal'?'personal':'family';
      item.deviceIds=Array.isArray(extra.deviceIds)?extra.deviceIds:Array.isArray(original.deviceIds)?original.deviceIds:notes.deviceIds??[];
      unique.set(item.id,item);
    }
    return [...unique.values()];
  }
  const findService=id=>services().find(item=>item.id===id);

  container.classList.add('hs-home');
  container.setAttribute('aria-labelledby','hs-heading');
  container.innerHTML=`<header class="hs-section-heading"><h2 id="hs-heading"><span class="hs-care-icon" aria-hidden="true"><img src="assets/home-care.svg" alt=""></span>小元的关注照料</h2><button class="hs-more" data-hs-action="more">更多${chevron}</button></header><div class="hs-feed" data-hs-feed="home"></div>`;
  listPage.classList.add('hs-page');
  listPage.setAttribute('aria-labelledby','hs-page-title');
  listPage.innerHTML=`<header class="hs-page-header"><button class="hs-back" data-hs-action="back" aria-label="返回首页">${glyph('back')}</button><h1 id="hs-page-title">小元的关注照料</h1><button class="hs-records-entry" data-hs-action="records">全部记录</button></header><main class="hs-page-scroll"><div class="hs-filters" role="tablist" aria-label="服务状态"><button role="tab" aria-selected="true" data-hs-filter="all">全部</button><button role="tab" aria-selected="false" data-hs-filter="active">正在关注</button><button role="tab" aria-selected="false" data-hs-filter="done">近期结果</button></div><div class="hs-feed" data-hs-feed="list"></div></main><span class="hs-home-indicator" aria-hidden="true"></span>`;

  function inferredDevices(item){
    const all=devices();
    if(item.deviceIds?.length)return item.deviceIds.map(id=>all.find(device=>device.id===id)).filter(Boolean);
    const text=`${item.title} ${item.summary} ${entriesFor(item.id).map(row=>row.text).join(' ')}`;
    return all.filter(device=>device.name&&text.includes(device.name));
  }
  function picture(item){
    const linked=inferredDevices(item);
    if(isEvent(item)&&linked.length>1)return `<span class="hs-card-picture hs-picture-event" aria-hidden="true">${linked.slice(0,2).map(device=>`<img src="${e(device.image)}" alt="">`).join('')}</span>`;
    const image=item.image??linked[0]?.image;
    if(image)return `<span class="hs-card-picture${item.picture==='lamp'?' hs-picture-lamp':''}"><img src="${e(image)}" alt="" loading="lazy"></span>`;
    return `<span class="hs-card-picture hs-picture-document" aria-hidden="true">${glyph('detail')}</span>`;
  }
  const restoreIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4v7h7"/><path d="M3.5 10a8.5 8.5 0 1 1 2.2 8"/></svg>';
  const adjustIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h8m6 0h2M4 17h2m6 0h8"/><circle cx="15" cy="7" r="3"/><circle cx="9" cy="17" r="3"/></svg>';
  function cardMarkup(item){
    const action=cardAction(item),restore=restorations.info(item),editable=inferredDevices(item).some(device=>typeof device.power==='boolean');
    const title=restore?.status==='done'?restore.title:item.title,summary=restore?.status==='done'?restore.summary:item.summary;
    const restoreLabel=restore?.status==='running'?'正在恢复':restore?.status==='done'?'已恢复':restore?.status==='failed'?'重试恢复':'恢复调整前';
    const operations=isEvent(item)?`<button class="hs-card-operation" data-hs-control="${e(item.id)}" aria-label="调整或纠正：${e(title)}">${adjustIcon}<span>调整或纠正</span></button>`:editable?`<button class="hs-card-operation" data-hs-restore="${e(item.id)}" aria-label="${e(restoreLabel)}：${e(title)}" ${restore?.disabled?'disabled':''}>${restoreIcon}<span>${e(restoreLabel)}</span></button><span class="hs-action-divider" aria-hidden="true"></span><button class="hs-card-operation" data-hs-custom="${e(item.id)}" aria-label="自定义调整：${e(title)}">${adjustIcon}<span>自定义调整</span></button>`:`<button class="hs-card-operation" data-hs-control="${e(item.id)}" aria-label="${e(action.label)}：${e(title)}">${adjustIcon}<span>${e(action.label)}</span></button>`;
    return `<button class="hs-card-open" data-hs-open="${e(item.id)}" aria-label="${e(title)}，查看为什么这么做"><span class="hs-card-main">${picture(item)}<span class="hs-card-copy"><strong>${e(title||'服务进展已更新')}</strong><span class="hs-card-summary">${e(summary)}</span><span class="hs-card-stamp">${item.scope==='personal'?'<span class="hs-personal">仅自己</span>':''}<time>${e(moment(restore?.at||item.at))}</time></span></span></span></button><div class="hs-card-footer"><button class="hs-card-why" data-hs-why="${e(item.id)}">为什么这么做${chevron}</button><div class="hs-card-operations">${operations}</div></div>`;
  }
  function cardAction(item){
    if(isEvent(item))return {type:'event',label:'调整或纠正'};
    if(isActive(item)&&typeof item.manage==='function')return {type:'scenario',label:'调整'};
    if(inferredDevices(item).some(device=>typeof device.power==='boolean'))return {type:'device',label:'调整'};
    if(item.cardAction==='correct')return {type:'correct',label:'纠正'};
    if(inferredDevices(item).length)return {type:'device',label:inferredDevices(item).some(device=>typeof device.power==='boolean')?'调整':'查看'};
    return item.converse?{type:'converse',label:'修改'}:{type:'correct',label:'纠正'};
  }
  function scrollParent(element){
    for(let parent=element.parentElement;parent;parent=parent.parentElement)if(/auto|scroll/u.test(getComputedStyle(parent).overflowY)&&parent.scrollHeight>parent.clientHeight)return parent;
    return document.scrollingElement;
  }
  function keepPosition(surface,callback){
    const scroller=scrollParent(surface),top=scroller?.scrollTop??0;
    const edge=scroller?.getBoundingClientRect().top??0;
    const anchor=[...surface.querySelectorAll('[data-hs-id]')].find(node=>node.getBoundingClientRect().bottom>edge);
    const before=anchor?.getBoundingClientRect().top;
    callback();
    if(scroller&&top>20){if(anchor?.isConnected&&Number.isFinite(before))scroller.scrollTop=top+anchor.getBoundingClientRect().top-before;else scroller.scrollTop=top;}
  }
  function renderCards(surface,items,{empty='这里会接续小元正在处理的事'}={}){
    keepPosition(surface,()=>{
      const wanted=new Set(items.map(item=>item.id));
      [...surface.children].forEach(node=>{if(!wanted.has(node.dataset.hsId))node.remove();});
      if(!items.length){surface.innerHTML=`<div class="hs-empty"><strong>暂时没有${filter==='done'&&surface.dataset.hsFeed==='list'?'近期结果':'需要继续的事'}</strong><p>${e(empty)}</p></div>`;return;}
      for(const [index,item]of items.entries()){
        let card=[...surface.children].find(node=>node.dataset.hsId===item.id);
        if(!card){card=document.createElement('article');card.className='hs-service-card';card.dataset.hsId=item.id;}
        const html=cardMarkup(item);
        if(signatures.get(card)!==html){card.innerHTML=html;signatures.set(card,html);}
        card.setAttribute('aria-label',item.title);
        if(surface.children[index]!==card)surface.insertBefore(card,surface.children[index]??null);
      }
    });
  }
  function orderedServices(){
    const all=services(),ids=new Set(all.map(item=>item.id));
    order=order.filter(id=>ids.has(id));
    const initialPriority=item=>item.scope==='personal'?1:0;
    const newItems=all.filter(item=>!order.includes(item.id)).sort((a,b)=>initialPriority(a)-initialPriority(b)||(b.at??0)-(a.at??0));
    order=[...newItems.map(item=>item.id),...order];
    const map=new Map(all.map(item=>[item.id,item]));
    return order.map(id=>map.get(id));
  }
  function refresh(){
    const all=orderedServices();
    renderCards(container.querySelector('[data-hs-feed]'),all);
    const visible=all.filter(item=>filter==='all'||(filter==='active'?isActive(item):!isActive(item)));
    renderCards(query('[data-hs-feed]'),visible,{empty:filter==='done'?'完成的服务与结果会保留在这里':'有新的进展时，会在这里接上'});
    if(sheet?.open&&sheet.dataset.content==='home-service'&&detailId)updateDetail();
    if(sheet?.open&&sheet.dataset.content==='home-service-records')updateRecords();
    if(sheet?.open&&sheet.dataset.content==='home-service-adjust')renderAdjustment();
  }
  function showList(){
    refresh();setView?.('home-services');view='home-services';listPage.hidden=false;
    query('.hs-page-scroll').scrollTop=listScroll;
    query('#hs-page-title').setAttribute('tabindex','-1');query('#hs-page-title').focus({preventScroll:true});
  }
  function focusCard(id,{action=false}={}){
    const host=view==='home-services'?listPage:container;
    [...host.querySelectorAll('[data-hs-id]')].find(node=>node.dataset.hsId===id)?.querySelector(action?'[data-hs-custom],[data-hs-control]':'[data-hs-open]')?.focus({preventScroll:true});
  }
  function openDeviceControls(item,{fromDetail=false}={}){
    const related=inferredDevices(item);
    if(!related.length){openCorrection(item);return;}
    if(fromDetail)saveSheetPosition();
    const go=device=>{if(sheet.open)sheet.close();onDeviceDetail?.(device.id,{serviceId:item.id,returnTo:view,fromCard:!fromDetail});};
    if(related.length===1){go(related[0]);return;}
    openSheet('调整这次照料',`<p class="sheet-description">选择需要调整的设备，按当前需要修改。</p><div class="hs-related hs-adjust-devices">${related.map(device=>`<button data-hs-adjust-device="${e(device.id)}"><span><strong>${e(device.name)}</strong><small>${e(roomName(device.roomId))} · ${e(device.online===false?'离线，查看连接':device.statusText??'查看设备')}</small></span>${chevron}</button>`).join('')}</div>`,{restoreFocus:()=>focusCard(item.id,{action:true})});
    sheet.dataset.content='home-service-adjust';
    sheet.querySelectorAll('[data-hs-adjust-device]').forEach(button=>{button.onclick=()=>go(related.find(device=>device.id===button.dataset.hsAdjustDevice));});
  }
  function adjustmentMarkup(item){
    const restore=restorations.info(item);
    return `<p class="hs-adjust-context">${e(item.title)}</p><section class="hs-adjust-target"><h3>恢复后的设置</h3>${restore?restore.targets.map(text=>`<p>${e(text)}</p>`).join(''):'<p class="hs-adjust-muted">这条记录未保留完整的调整前设置，可按当前需要自定义调整。</p>'}</section>${restore?'<p class="hs-adjust-note">只恢复这次操作改变的设置，其他设置保持当前值。</p>':''}${adjustmentNotice||restore?.message?`<div class="hs-adjust-feedback" role="status">${e(adjustmentNotice||restore.message)}</div>`:''}`;
  }
  function renderAdjustment(){
    const host=sheet.querySelector('#hs-adjustment-body'),item=adjustmentContext&&findService(adjustmentContext.id);
    if(!host||!item)return;
    const scroll=sheet.querySelector('.sheet-body').scrollTop;
    host.innerHTML=adjustmentMarkup(item);
    const restore=restorations.info(item),button=sheet.querySelector('#hs-adjust-restore'),custom=sheet.querySelector('#hs-adjust-custom');
    button.textContent=restore?.label||'恢复调整前设置';button.disabled=!restore||restore.disabled;
    custom.disabled=restore?.status==='running';custom.className=restore?'secondary-button':'primary-button';
    sheet.querySelector('.sheet-body').scrollTop=scroll;
  }
  function adjustDevices(item,{fromDetail=false}={}){
    if(!inferredDevices(item).length){openCorrection(item,{fromDetail});return;}
    if(fromDetail)saveSheetPosition();
    adjustmentContext={id:item.id,fromDetail};adjustmentNotice='';
    const back=()=>fromDetail?openDetail(item.id,{restoreScroll:true}):sheet.close();
    openSheet('调整这次操作','<div id="hs-adjustment-body"></div><div class="dialog-actions"><button class="primary-button" id="hs-adjust-restore">恢复调整前设置</button><button class="secondary-button" id="hs-adjust-custom">自定义调整</button></div>',{onCancel:back,restoreFocus:()=>focusCard(item.id,{action:true})});
    sheet.dataset.content='home-service-adjust';renderAdjustment();
    sheet.querySelector('#hs-adjust-restore').onclick=()=>restoreDevices(findService(item.id)||item);
    sheet.querySelector('#hs-adjust-custom').onclick=()=>openDeviceControls(findService(item.id)||item,{fromDetail});
  }
  async function restoreDevices(item){
    adjustmentNotice='';
    const result=await restorations.restore(item);
    if(result.ok)toast?.('已恢复调整前的设置');
    else if(result.code!=='busy')adjustmentNotice=result.message;
    if(sheet.open&&sheet.dataset.content==='home-service-adjust'&&adjustmentContext?.id===item.id)renderAdjustment();
    else if(!result.ok&&result.code!=='busy')toast?.(result.message);
  }
  function openCorrection(item,{fromDetail=false}={}){
    if(isEvent(item)){openEventAdjustment(item,{fromDetail});return;}
    if(fromDetail)saveSheetPosition();
    if(typeof item.correct==='function'){item.correct({onReturn:()=>fromDetail?openDetail(item.id,{restoreScroll:true}):focusCard(item.id,{action:true})});return;}
    const previous=item.feedback?.text??'';
    const cancel=()=>fromDetail?openDetail(item.id,{restoreScroll:true}):sheet.close();
    openSheet('纠正这次照料',`<p class="sheet-description">告诉小元哪里不合适，或需要如何调整。</p><label class="form-label" for="hs-correction-input">你的补充</label><textarea class="hs-correction-input" id="hs-correction-input" maxlength="300" placeholder="例如：厨房还有人在使用，离家时请保留这盏灯">${e(previous)}</textarea><p class="hs-correction-hint">补充随本次照料保留，已发生的执行记录仍可回看。</p><div class="dialog-actions"><button class="secondary-button" id="hs-correction-cancel">取消</button><button class="primary-button" id="hs-correction-save" disabled>保存纠正</button></div>`,{onCancel:cancel,restoreFocus:()=>focusCard(item.id,{action:!fromDetail})});
    sheet.dataset.content='home-service-correction';
    const input=sheet.querySelector('#hs-correction-input'),save=sheet.querySelector('#hs-correction-save');
    input.oninput=()=>{save.disabled=!input.value.trim()||input.value.trim()===previous;};
    sheet.querySelector('#hs-correction-cancel').onclick=cancel;
    save.onclick=()=>{
      const text=input.value.trim();if(!text||text===previous)return;
      const feedback={text,at:previewNow()};
      supplements.set(item.id,{...supplements.get(item.id),feedback,at:feedback.at});
      onRecord?.({experienceId:item.id,scope:item.scope,label:'用户纠正',text,at:feedback.at});
      refresh();
      if(fromDetail)openDetail(item.id,{restoreScroll:true});else sheet.close();
      toast?.('纠正已记下');
    };
  }
  function correctionMarkup(item){
    if(isEvent(item))return (item.eventCorrections||[]).map(entry=>`<div class="hs-feedback"><strong>你的纠正</strong><p>${e(entry.text)}</p><time>${e(moment(entry.at))}</time></div>`).join('');
    const restore=restorations.info(item);
    return `${restore?.message?`<div class="hs-feedback" role="status"><strong>${restore.status==='done'?'后续恢复':'恢复反馈'}</strong><p>${e(restore.message)}</p>${restore.at?`<time>${e(moment(restore.at))}</time>`:''}</div>`:''}${item.adjustment?`<div class="hs-feedback"><strong>你调整了设备</strong><p>${e(item.adjustment.text)}</p><time>${e(moment(item.adjustment.at))}</time></div>`:''}${item.feedback?`<div class="hs-feedback"><strong>你的纠正</strong><p>${e(item.feedback.text)}</p><time>${e(moment(item.feedback.at))}</time></div>`:''}<button class="hs-correct-link" data-hs-sheet="correct">${item.feedback?'修改这条纠正':'纠正这次照料'}</button>`;
  }
  function evidenceFor(item,rows){
    if(item.evidence?.length)return item.evidence.map(value=>{
      if(typeof value==='string')return {source:'相关依据',value};
      const linked=value.match?rows.find(row=>row.label===value.match):null;
      return {...value,source:value.title??value.source??value.name??value.label??'相关依据',value:value.value??value.text??value.data??value.detail??'',label:value.label??(value.title?value.source:undefined),at:value.at??linked?.at};
    });
    const first=rows[0];
    return first?[{source:item.scope==='personal'?'相关会话记录':'相关服务记录',value:first.text,label:first.label??'已保存记录',at:first.at}]:[];
  }
  function stepsFor(item,rows){
    const steps=item.steps?.length?item.steps:rows;
    return steps.map(step=>typeof step==='string'?{label:'服务进展',text:step}:{...step,label:step.label??step.title??'进展已更新',text:step.text??step.description??step.summary??step.detail??'',at:step.at??step.updatedAt});
  }
  function reasonFor(item){
    if(item.reason)return item.reason;
    if(item.scope==='personal')return '这项协助来自你的请求。我会保留已经明确的内容，需要补充或确认的部分会单独说明';
    if(entriesFor(item.id).some(row=>/用户|吩咐|手动|你/u.test(`${row.label} ${row.text}`)))return '这次变化来自你的操作或明确请求，结果以设备反馈和相关记录为准';
    return '根据当时的请求与已保存信息接续这件事，具体经过和已确认的结果保留在下方';
  }
  function nextFor(item){
    if(item.next)return item.next;
    if(/未完成|失败|未确认|部分/u.test(statusText(item)))return '尚未确认的部分会继续保留，连接与条件恢复后再处理';
    if(isActive(item))return '继续等待相关反馈，有新的进展时会更新这同一件事';
    return '这次记录已保留，之后的变化会依据新的请求和信息处理';
  }
  function detailMarkup(item){
    const rows=entriesFor(item.id),evidence=evidenceFor(item,rows),steps=stepsFor(item,rows),related=inferredDevices(item);
    return `${detailFromRecords?`<button class="hs-detail-return" data-hs-sheet="records">${glyph('back')}返回全部记录</button>`:''}<div class="hs-detail-intro"><div class="hs-detail-meta"><time>${e(moment(item.at))}</time><span data-tone="${tone(item)}">${e(statusText(item))}</span>${item.scope==='personal'?'<span>仅自己可见</span>':''}</div><h3>${e(item.title)}</h3><p>${e(item.summary)}</p></div><section class="hs-detail-section"><h3>为什么这么做</h3><p>${e(reasonFor(item))}</p>${correctionMarkup(item)}</section><section class="hs-detail-section"><h3>依据什么</h3>${evidence.length?`<div class="hs-evidence-list">${evidence.map(row=>`<div class="hs-evidence"><div><strong>${e(row.source)}</strong>${row.label?`<span>${e(row.label)}</span>`:''}</div><p>${e(row.value)}</p>${stamp(row.at)?`<time>${e(moment(row.at))}</time>`:''}</div>`).join('')}</div>`:'<p class="hs-detail-muted">现有记录未保留更多来源数据</p>'}</section><section class="hs-detail-section"><h3>执行经过</h3>${steps.length?`<ol class="hs-steps">${steps.map(step=>`<li><div><strong>${e(step.label)}</strong>${stamp(step.at)?`<time>${e(moment(step.at))}</time>`:''}</div><p>${e(step.text)}</p></li>`).join('')}</ol>`:'<p class="hs-detail-muted">还没有新的执行反馈</p>'}</section><section class="hs-detail-section"><h3>接下来</h3><p>${e(nextFor(item))}</p></section>${related.length?`<section class="hs-detail-section hs-related"><h3>相关设备</h3>${related.map(device=>`<button data-hs-device="${e(device.id)}"><span><strong>${e(device.name)}</strong><small>${e(roomName(device.roomId))} · 当前${device.online===false?'离线':device.statusText??device.cardStatusText??'在线'}</small></span>${chevron}</button>`).join('')}<p class="hs-related-note">这里显示设备当前状态，执行经过保留当时反馈</p></section>`:''}`;
  }
  function actionsMarkup(item){
    if(isEvent(item))return '<button class="primary-button" data-hs-sheet="event-adjust">调整或纠正</button>';
    const actions=[];
    if(inferredDevices(item).some(device=>typeof device.power==='boolean'))actions.push('<button class="primary-button" data-hs-sheet="adjust">调整</button>');
    if(isActive(item)&&typeof item.manage==='function'){
      actions.push('<button class="primary-button" data-hs-sheet="manage-scene">调整照料</button>');
      if(typeof item.end==='function')actions.push('<button class="secondary-button" data-hs-sheet="end-scene">结束本次照料</button>');
    }
    if(typeof item.retry==='function'&&/未完成|失败|未确认|部分|受阻/u.test(statusText(item)))actions.push('<button class="primary-button" data-hs-sheet="retry">重试未完成项</button>');
    if(item.converse&&onConverse)actions.push(`<button class="${actions.length?'secondary':'primary'}-button" data-hs-sheet="converse">在会话中继续</button>`);
    return actions.join('');
  }
  function updateDetail(){
    const item=findService(detailId),body=sheet.querySelector('.hs-detail');
    if(!item||!body)return;
    const scroller=sheet.querySelector('.sheet-body'),before=scroller.scrollTop,focused=document.activeElement;
    const deviceFocus=focused?.dataset.hsDevice,actionFocus=focused?.dataset.hsSheet;
    const html=detailMarkup(item);
    if(signatures.get(body)!==html){body.innerHTML=html;signatures.set(body,html);}
    const actions=actionsMarkup(item);let footer=sheet.querySelector('.hs-detail-actions');
    if(actions){
      if(!footer){let holder=sheet.querySelector('.sheet-actions');if(!holder){holder=document.createElement('div');holder.className='sheet-actions';sheet.append(holder);}footer=document.createElement('div');footer.className='dialog-actions hs-detail-actions';holder.append(footer);}
      if(footer.innerHTML!==actions)footer.innerHTML=actions;
    }else if(footer){const holder=footer.parentElement;footer.remove();if(!holder.children.length)holder.remove();}
    scroller.scrollTop=before;
    if(deviceFocus)[...sheet.querySelectorAll('[data-hs-device]')].find(button=>button.dataset.hsDevice===deviceFocus)?.focus({preventScroll:true});
    else if(actionFocus)[...sheet.querySelectorAll('[data-hs-sheet]')].find(button=>button.dataset.hsSheet===actionFocus)?.focus({preventScroll:true});
  }
  function saveSheetPosition(){
    if(!sheet?.open)return;
    const scroller=sheet.querySelector('.sheet-body');
    if(sheet.dataset.content==='home-service-records')recordsScroll=scroller.scrollTop;
    else if(sheet.dataset.content==='home-service'&&detailId)detailPositions.set(detailId,{scroll:scroller.scrollTop,fromRecords:detailFromRecords});
  }
  function openEventAdjustment(item,{fromDetail=false}={}){
    if(fromDetail)saveSheetPosition();
    eventAdjustment.open(item,{onReturn:fromDetail?()=>openDetail(item.id,{restoreScroll:true}):null,restoreFocus:()=>focusCard(item.id,{action:true})});
  }
  function openDetail(id,{fromRecords,restoreScroll=false}={}){
    const item=findService(id);if(!item){toast?.('这条服务记录暂不可用');return;}
    saveSheetPosition();
    const saved=detailPositions.get(id);
    detailId=id;detailFromRecords=fromRecords??(restoreScroll?saved?.fromRecords:false)??false;detailRestore=()=>detailFromRecords?query('[data-hs-action="records"]')?.focus({preventScroll:true}):focusCard(id);
    const actions=actionsMarkup(item);
    openSheet('为什么这么做',`<div class="hs-detail">${detailMarkup(item)}</div>${actions?`<div class="dialog-actions hs-detail-actions">${actions}</div>`:''}`,{restoreFocus:detailRestore});
    sheet.dataset.content='home-service';
    if(restoreScroll&&saved)sheet.querySelector('.sheet-body').scrollTop=saved.scroll;
  }
  function recordMarkup(){
    const rows=records().sort((a,b)=>(stamp(b.at)??0)-(stamp(a.at)??0));
    if(!rows.length)return '<div class="hs-empty"><strong>还没有记录</strong><p>发生过的变化会按时间保留在这里</p></div>';
    const available=new Set(services().map(item=>item.id));
    let group='';
    return rows.map(row=>{
      const day=dayText(row.at),heading=day!==group?`<h3 class="hs-record-day">${e(day)}</h3>`:'';group=day;
      const id=row.experienceId??row.serviceId,linked=available.has(id),tag=linked?'button':'div';
      return `${heading}<${tag} class="hs-record-row" data-hs-record="${e(row.id??`${id}-${row.at}`)}" ${linked?`data-hs-record-service="${e(id)}"`:''}><time>${e(timeText(row.at))}</time><span><strong>${e(row.label??row.title??'进展更新')}${row.scope==='personal'?'<small>仅自己</small>':''}</strong><span>${e(row.text??row.summary??'')}</span></span>${linked?chevron:''}</${tag}>`;
    }).join('');
  }
  function updateRecords(){
    const host=sheet.querySelector('.hs-records');if(!host)return;
    const scroller=sheet.querySelector('.sheet-body'),before=scroller.scrollTop;
    const anchor=[...host.querySelectorAll('[data-hs-record]')].find(row=>row.getBoundingClientRect().bottom>scroller.getBoundingClientRect().top);
    const anchorId=anchor?.dataset.hsRecord,anchorTop=anchor?.getBoundingClientRect().top;
    const focusId=document.activeElement?.dataset.hsRecord;
    host.innerHTML=recordMarkup();
    const replacement=[...host.querySelectorAll('[data-hs-record]')].find(row=>row.dataset.hsRecord===anchorId);
    scroller.scrollTop=before+(replacement&&Number.isFinite(anchorTop)?replacement.getBoundingClientRect().top-anchorTop:0);
    if(focusId)[...host.querySelectorAll('[data-hs-record]')].find(row=>row.dataset.hsRecord===focusId)?.focus({preventScroll:true});
  }
  function openRecords({restoreScroll=false}={}){
    saveSheetPosition();
    if(!restoreScroll){recordsScroll=0;recordsFocusId=null;}
    detailId=null;
    openSheet('全部记录',`<div class="hs-records">${recordMarkup()}</div>`,{restoreFocus:()=>query('[data-hs-action="records"]')?.focus({preventScroll:true})});
    sheet.dataset.content='home-service-records';
    sheet.querySelector('.sheet-body').scrollTop=recordsScroll;
    if(restoreScroll&&recordsFocusId)[...sheet.querySelectorAll('[data-hs-record]')].find(row=>row.dataset.hsRecord===recordsFocusId)?.focus({preventScroll:true});
  }
  async function restoreFromCard(item){
    const origin=view;
    const result=await restorations.restore(item);
    if(result.ok){toast?.('已恢复调整前的设置');return;}
    if(result.code==='busy')return;
    if(view!==origin||sheet.open){toast?.(result.message);return;}
    adjustDevices(findService(item.id)||item);adjustmentNotice=result.message;renderAdjustment();
  }
  function click(event){
    const restore=event.target.closest('[data-hs-restore]');if(restore){const item=findService(restore.dataset.hsRestore);if(item)restoreFromCard(item);return;}
    const custom=event.target.closest('[data-hs-custom]');if(custom){const item=findService(custom.dataset.hsCustom);if(item)openDeviceControls(item);return;}
    const control=event.target.closest('[data-hs-control]');
    if(control){
      const item=findService(control.dataset.hsControl);if(!item)return;
      const action=cardAction(item);
      if(action.type==='event')openEventAdjustment(item);
      else if(action.type==='device'){if(inferredDevices(item).some(device=>typeof device.power==='boolean'))adjustDevices(item);else openDeviceControls(item);}
      else if(action.type==='scenario')item.manage({onReturn:()=>focusCard(item.id,{action:true})});
      else if(action.type==='converse')onConverse?.({serviceId:item.id,title:item.title,prompt:item.converse,scope:item.scope,fromCard:true});
      else openCorrection(item);
      return;
    }
    const open=event.target.closest('[data-hs-open],[data-hs-why]');if(open){openDetail(open.dataset.hsOpen||open.dataset.hsWhy);return;}
    const action=event.target.closest('[data-hs-action]')?.dataset.hsAction;
    if(action==='more')showList();
    else if(action==='back'){listScroll=query('.hs-page-scroll').scrollTop;onBack?.();}
    else if(action==='records')openRecords();
    const selected=event.target.closest('[data-hs-filter]');
    if(selected){filter=selected.dataset.hsFilter;listPage.querySelectorAll('[data-hs-filter]').forEach(button=>{const active=button===selected;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});refresh();query('.hs-page-scroll').scrollTop=0;}
  }
  container.addEventListener('click',click);listPage.addEventListener('click',click);
  listPage.querySelector('.hs-filters').addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    const buttons=[...listPage.querySelectorAll('[data-hs-filter]')],index=buttons.indexOf(document.activeElement);
    if(index<0)return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
    buttons[next].click();buttons[next].focus({preventScroll:true});
  });
  sheet?.addEventListener('click',async event=>{
    if(!['home-service','home-service-records'].includes(sheet.dataset.content))return;
    const record=event.target.closest('[data-hs-record-service]');if(record){recordsFocusId=record.dataset.hsRecord;openDetail(record.dataset.hsRecordService,{fromRecords:true});return;}
    const device=event.target.closest('[data-hs-device]');if(device){saveSheetPosition();sheet.close();onDeviceDetail?.(device.dataset.hsDevice,{serviceId:detailId,returnTo:view});return;}
    const target=event.target.closest('[data-hs-sheet]');if(!target)return;
    if(target.dataset.hsSheet==='records'){openRecords({restoreScroll:true});return;}
    const item=findService(detailId);if(!item)return;
    if(target.dataset.hsSheet==='event-adjust'){openEventAdjustment(item,{fromDetail:true});return;}
    if(target.dataset.hsSheet==='adjust'){adjustDevices(item,{fromDetail:true});return;}
    if(target.dataset.hsSheet==='manage-scene'&&typeof item.manage==='function'){saveSheetPosition();item.manage({onReturn:()=>openDetail(item.id,{restoreScroll:true})});return;}
    if(target.dataset.hsSheet==='end-scene'&&typeof item.end==='function'){saveSheetPosition();item.end({onReturn:()=>openDetail(item.id,{restoreScroll:true})});return;}
    if(target.dataset.hsSheet==='correct'){openCorrection(item,{fromDetail:true});return;}
    if(target.dataset.hsSheet==='converse'){saveSheetPosition();sheet.close();onConverse?.({serviceId:item.id,title:item.title,prompt:item.converse,scope:item.scope});return;}
    if(target.dataset.hsSheet==='retry'&&typeof item.retry==='function'){
      target.disabled=true;target.textContent='正在重试';
      try{const result=await item.retry();if(result?.ok===false)toast?.(result.message??'暂时无法重试，请稍后再试');}
      catch{toast?.('暂时无法重试，请稍后再试');}
      finally{refresh();if(target.isConnected){target.disabled=false;target.textContent='重试未完成项';}}
    }
  });
  listPage.querySelectorAll('[data-hs-filter]').forEach((button,index)=>{button.tabIndex=index? -1:0;});
  refresh();
  return {
    refresh,open:showList,openDetail,focusCard,getService:findService,
    record(data={}){const id=data.experienceId??data.id;if(id&&data.controlChange&&!data.restoring){const previous=supplements.get(id)||{},changes=previous.restoreChanges||[];supplements.set(id,{...previous,restoreChanges:[...changes.filter(change=>change.deviceId!==data.controlChange.deviceId),data.controlChange]});restorations.reset(id);}if(id&&(data.deviceIds||data.evidence||data.reason||data.steps||data.kind||data.source||data.origin))supplements.set(id,{...supplements.get(id),...Object.fromEntries(Object.entries(data).filter(([,value])=>value!==undefined))});refresh();},
    upsert(data={}){const id=data.id??data.experienceId;if(id)supplements.set(id,{...supplements.get(id),...Object.fromEntries(Object.entries(data).filter(([,value])=>value!==undefined))});refresh();},
    onViewChange(next){eventAdjustment.detach();if(view==='home-services')listScroll=query('.hs-page-scroll').scrollTop;view=next;listPage.hidden=next!=='home-services';if(next==='home'||next==='home-services')refresh();}
  };
}
