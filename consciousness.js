import {previewNow,previewDate} from './preview-clock.js';
// One record stream powers the full journal and the selected experiences.
// This standalone preview uses a fixed illustrative local day and local data only.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const trim=value=>String(value??'').replace(/[。．.]+$/u,'');
const day=Date.parse(previewDate+'T00:00:00+08:00');
const clock=previewNow;
const at=(days,hours,minutes)=>day+days*86400000+hours*3600000+minutes*60000;
const time=value=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(value);
const dateKey=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(value);
const dayLabel=value=>dateKey(value)===dateKey(clock())?'今天':dateKey(value)===dateKey(day-86400000)?'昨天':new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'long',day:'numeric'}).format(value);
const moment=value=>`${dayLabel(value)} ${time(value)}`;

export const idleExpressions=[
  {phrase:'我在留意家里的变化',context:'客厅有人安静停留，空气平稳。厨房和卫生间的近况也已更新',more:'我会把在场与环境变化放在一起看。有些空间还在等待新的感知，暂时保留已知的部分',needs:'living'},
  {phrase:'客厅有人安静停留，空气也很平稳。先让这一刻继续舒服一些',context:'这会儿没有需要调整的变化，我会继续留意',more:'有时，照顾一个空间就是让合适的状态继续。等出现值得关注的变化，我再接着处理',needs:'living'},
  {phrase:'昨晚的灯光调整，我还记得',context:'那次你想让灯光柔和一些，后来又聊到了阅读时的亮度',more:'我开始理解，舒服的光线会随正在做的事变化。同一个客厅，也可以有不同的光线',relatedId:'evening-light'},
  {phrase:'同一个客厅，也会有不同的光线。读书时明亮一些，休息时柔和一些',context:'我在回顾我们聊过的晚间照明，还会继续结合你的反馈理解',more:'这段理解来自你的表达，还需要结合之后的使用观察。我会保留当时的上下文',relatedId:'evening-light'},
  {phrase:'有些空间，还等着新的感知',context:'家的结构已经连起来了，部分空间的近况还在等待更新',more:'我知道空间之间的关系，也会保留感知暂时缺失的部分。新的信息到来时，再把近况接上',relatedId:'space-outline'},
  {phrase:'家的轮廓已经连起来了。等新的信息到来，我会接上那些还不清楚的近况',context:'空间结构与实时近况，会一起组成我对这个家的理解',more:'空间被保存下来，并不意味着近况已更新。我会分别记住已经知道的和仍在等待的部分',relatedId:'space-outline'},
  {phrase:'家，也有自己的节奏',context:'我想起昨晚关于安静换气的讨论，舒服也包括不被打扰',more:'同样的客厅，可以容纳热闹，也可以留给安静。那次关于安静的讨论，让我又想起了空间里不同的生活节奏',relatedId:'quiet-thought'},
  {phrase:'同样的客厅，可以容纳热闹，也可以留给安静。舒适也许藏在这些变化里',context:'一段关于家的联想，从过去的经历慢慢延伸出来',more:'我会把这些片刻和真实发生的事联系起来，继续理解这个家的节奏',relatedId:'quiet-thought'}
];

export function getIdleExpression(index,rooms){
  const item={...idleExpressions[index%idleExpressions.length]};
  const waiting=rooms.some(r=>!r.observed),slot=index%idleExpressions.length;
  if(!waiting&&slot===0)item.more='我会把在场、活动与环境变化放在一起看，保留每个空间的近况与感知来源';
  if(!waiting&&[4,5].includes(slot)){
    item.phrase=slot===4?'各个空间的近况，已经接上了':'家的轮廓与此刻的近况，正在慢慢连起来。我会继续留意在场、活动和环境的变化';
    item.context='已接入空间的在场、活动和环境信息，一起组成此刻的家庭近况';
    item.more='空间结构与实时近况是两件事。我会结合已有感知继续留意变化，新的信息到来时再更新';
  }
  if(index%idleExpressions.length===0){const available=rooms.filter(r=>r.observed).map(r=>r.name);item.context=available.length?`${available.join('、')}的近况已经接上，我会继续留意在场和环境的变化`:'我会保留已经知道的空间结构，继续等待新的感知信息';}
  if(item.needs&&!rooms.some(r=>r.id===item.needs&&r.observed)){
    item.phrase=index%2?'我会继续留意已经接入的空间。等新的信息到来，再接上它们的近况':'我在留意已知的空间变化';
    item.context='我会结合已有的感知理解变化，缺少信息的部分继续等待更新';
  }
  return item;
}

const seeds=[
  {id:'evening-light',title:'客厅灯光已调暗',summary:'客厅主灯从60%调至35%，看电视时更柔和，其他空间照明保留',state:'past',status:'已完成',tone:'good',entries:[
    [at(0,17,40),'收到用灯要求','你希望看电视时将客厅灯光调柔和一些'],
    [at(0,17,41),'发出调整请求','只将客厅主灯亮度由60%调至35%，其他空间保持'],
    [at(0,17,42),'灯光调整已确认','客厅主灯反馈亮度35%，本次设备调整已确认']
  ]},
  {id:'quiet-air',title:'客厅净化已切至低噪',summary:'按休息时的要求切换低噪模式，净化继续运行，减少设备声响',state:'past',status:'已反馈',tone:'good',entries:[
    [at(0,17,36),'收到低噪要求','你希望净化继续运行，同时把设备声音调低'],
    [at(0,17,37),'发出调整请求','空气置地机由标准切至低噪模式，继续净化'],
    [at(0,17,38),'低噪模式已确认','设备反馈低噪模式，仅确认运行状态，不据此推定空气质量改善']
  ]},
  {id:'kitchen-light',title:'厨房辅助灯已关闭',summary:'按本次离家安排收起厨房辅助照明，保留其他空间和持续感知',state:'past',status:'已完成',tone:'good',entries:[
    [at(0,17,28),'本次离家安排','你要求收起厨房辅助照明，家中其他空间照常'],
    [at(0,17,29),'发出调整请求','关闭厨房辅助灯，保留原亮度设定45%'],
    [at(0,17,30),'关闭反馈已确认','设备已反馈关闭，不将本次安排解释为全家无人']
  ]},
  {id:'bedroom-soft-light',title:'主卧床头灯已调柔',summary:'左侧床头灯已调至30%，右侧仍按家人当前使用保留',state:'past',status:'已完成',tone:'good',entries:[
    [at(0,17,8),'收到床头用灯要求','左侧灯柔和一些，右侧先保留当前亮度'],
    [at(0,17,9),'发出调整请求','仅将主卧左灯调至30%，不改变右侧灯'],
    [at(0,17,10),'床头灯调整已确认','左灯反馈亮度30%，没有据此形成长期偏好']
  ]},
  {id:'quiet-discussion',title:'晚间换气方式，正在梳理',summary:'刚才空气回稳后，我又想起你希望少被打扰，正在把环境结果与低噪方式联系起来',state:'active',status:'推进中',attentionPriority:4,entries:[
    [at(-1,18,35),'你说','“换气时尽量安静一点”'],
    [at(-1,18,36),'我回应','会优先考虑已授权的低噪方式，空气结果仍以环境反馈确认'],
    [at(0,17,44),'回看刚才的调整','低噪换气后空气回稳，也想起你希望尽量安静的讨论'],
    [at(0,17,45),'把两件事放在一起','对照环境结果与低噪方式，尚未改变后续服务安排'],
    [at(0,17,55),'还在梳理','继续整理已有经历与交流内容，等待更多实际反馈']
  ]},
  {id:'work-discussion',title:'方案整理，还在等资料',summary:'接着昨天梳理的重点，两份资料还没有补齐。我先保留已知的部分',scope:'personal',state:'active',status:'等待资料',tone:'waiting',attentionPriority:2,entries:[
    [at(-1,16,48),'你告诉我','今天要梳理方案，也有两份资料需要确认'],
    [at(-1,16,50),'一起整理','先明确方案的核心问题，再列出需要补充的资料，接下来更容易着手'],
    [at(0,10,40),'接着昨天的方案','你希望先理清方案的核心问题，需要的两份资料稍后补充'],
    [at(0,10,42),'保留已有重点','核心问题与待补资料分开整理，暂时不推定缺失资料里的结论'],
    [at(0,17,50),'还在等待资料','两份资料尚未补齐，下一步整理先停在这里']
  ]},
  {id:'space-outline',title:'家的轮廓，慢慢连起来了',summary:'六个空间已经纳入图谱。部分空间的近况，还在等待新的感知',entries:[
    [at(-1,16,20),'保存空间结构','客厅、主卧、次卧、卫生间、厨房、餐厅已纳入空间关系'],
    [at(-1,16,22),'接上已有近况','客厅、厨房和卫生间已接上感知，其余空间继续等待更新']
  ]},
  {id:'quiet-thought',title:'舒适，有时是不被打扰',summary:'我想，同一个客厅可以容纳热闹，也可以留给安静。家的节奏也许藏在这些变化里',entries:[
    [at(-2,20,5),'想起一个片刻','由过去关于安静的讨论，联想到空间里不同的生活节奏']
  ]}
];

export function createConsciousness({icon,openSheet,getRooms,onOpenAttention}){
  const $=selector=>document.querySelector(selector);
  const host=$('#consciousness-content');
  const experiences=new Map(),logs=[],savedExpressions=new Set();
  let serial=0,current=null,browsed=null,expressionVersion=0,lastEvent=null,attentionOrder=[],selectedAttentionId=null;
  let attentionMarkup='',attentionVersion=0,attentionNextAt=0,attentionManualUntil=0,attentionWasPaused=true,attentionSuppressClickUntil=0,attentionDirection=1,attentionGestureActive=false;
  let displayedId=null,phraseParts=[],partIndex=0,nextPartAt=0,revealDoneAt=0,revealPausedAt=0,partsMeasured=false;
  const partHold=5000;
  const cardMarkup=new WeakMap();
  const snapshots=[];
  for(const seed of seeds){
    const item={...seed,scope:seed.scope??'family',state:seed.state??'past',updatedAt:seed.entries.at(-1)[0]};
    delete item.entries;experiences.set(item.id,item);
    seed.entries.forEach(([at,label,text])=>logs.push({id:`seed-${serial++}`,experienceId:item.id,at,label,text,scope:item.scope}));
  }
  logs.push({id:`seed-${serial++}`,experienceId:'offline-bedroom',at:at(0,17,52),label:'还在等待连接',text:'卧室空调离线，自动调温暂不可用。没有发出控制请求',scope:'family'});
  // Older current expressions provide an immediately browsable, grounded context.
  snapshots.push({id:'before-now-1',at:at(0,18,4),...idleExpressions[4],status:'持续感知',kind:'idle'},
    {id:'before-now-2',at:at(0,18,2),...idleExpressions[2],status:'回顾片刻',kind:'idle'});
  host.innerHTML=`<section class="current-mind" aria-label="小元当前思考"><div class="mind-meta"><span id="mind-state"></span><button id="mind-expand" aria-label="查看思考详情">${icon('detail')}</button></div><div class="mind-symbol" aria-hidden="true"><img src="assets/consciousness.svg" alt=""></div><div class="mind-expression" id="mind-expression"><h2 id="mind-phrase"></h2><p id="mind-context"></p></div><div class="mind-navigation"><button id="mind-previous" aria-label="浏览上一条思考">${icon('back')}</button><span id="mind-position"></span><button id="mind-next" aria-label="浏览下一条思考">${icon('chevron')}</button><button id="mind-live" hidden>回到此刻</button></div><section class="mind-attention" id="mind-attention" aria-labelledby="attention-heading" hidden><div class="attention-section-heading"><h2 id="attention-heading">小元还在关注</h2><button id="open-attention-list"><span class="attention-count">0/0</span><span>查看更多</span></button></div><div class="attention-featured" id="attention-featured" aria-roledescription="轮播" aria-label="关注事项"></div></section></section><section class="past-experiences" aria-labelledby="experience-heading"><div class="experience-section-heading"><h2 id="experience-heading">意识的回响</h2><span>那些值得留下的经历、理解与联想</span></div><div id="experience-list" class="experience-list"></div></section><p class="journal-footnote">更多发生过的事，保留在最近日志里</p>`;
  $('#mind-previous').onclick=()=>browse(1);$('#mind-next').onclick=()=>browse(-1);
  $('#mind-live').onclick=()=>{browsed=null;renderCurrent();$('#mind-previous').focus({preventScroll:true});};
  $('#mind-expand').onclick=openCurrentDetail;
  $('#open-attention-list').onclick=()=>onOpenAttention?.();
  bindHorizontalSwipe($('#attention-featured'),direction=>shiftAttention(-direction),active=>{attentionGestureActive=active;if(!active){attentionManualUntil=Date.now()+3000;attentionNextAt=attentionManualUntil;}});
  $('#attention-featured').addEventListener('click',e=>{if(Date.now()<attentionSuppressClickUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
  $('#attention-featured').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();shiftAttention(e.key==='ArrowRight'?1:-1,{manual:true});}});

  function record({experienceId,title,summary,status,tone='neutral',state='past',scope='family',label,text,at:stamp=clock()}){
    if(experiences.get(experienceId)?.scope==='personal')scope='personal';
    const row={id:`record-${serial++}`,experienceId,at:stamp,label:trim(label),text:trim(text),scope};logs.push(row);
    if(experienceId&&title){
      const old=experiences.get(experienceId)??{};
      experiences.set(experienceId,{...old,id:experienceId,title,summary:trim(summary??text),status,tone,state,scope,updatedAt:stamp});
    }
    renderAttention(lastEvent);renderExperiences();return row;
  }
  function updateCurrent(value){
    const item={...value,phrase:trim(value.phrase),context:trim(value.context),more:trim(value.more),at:clock()};
    const changed=!current||current.phrase!==item.phrase||current.status!==item.status;
    if(changed){item.id=`expression-${serial++}`;snapshots.unshift(item);if(snapshots.length>32)snapshots.splice(snapshots.at(-1).id===browsed?.id?snapshots.length-2:snapshots.length-1,1);}
    else Object.assign(snapshots[0],item);
    current=snapshots[0];
    lastEvent=value.event;
    if(value.saveKey&&!savedExpressions.has(value.saveKey)){
      savedExpressions.add(value.saveKey);
      record({label:'留意到的片刻',text:item.phrase,scope:value.scope??'family'});
    }
    renderCurrent();renderAttention(lastEvent);renderExperiences();
  }
  function browse(direction){
    const position=browsed?snapshots.findIndex(n=>n.id===browsed.id):0;
    const next=Math.max(0,Math.min(snapshots.length-1,position+direction));
    browsed=next?snapshots[next]:null;renderCurrent();
  }
  function splitPhrase(text){
    const heading=$('#mind-phrase'),style=getComputedStyle(heading),width=heading.clientWidth||352;
    const visible=heading.getClientRects().length>0,lineHeight=parseFloat(style.lineHeight)||33;
    let probe=null;
    if(visible){
      probe=heading.cloneNode(false);probe.removeAttribute('id');probe.setAttribute('aria-hidden','true');
      Object.assign(probe.style,{position:'absolute',visibility:'hidden',pointerEvents:'none',width:`${width}px`,height:'auto',minHeight:'0',display:'block',webkitLineClamp:'unset',overflow:'visible',margin:'0'});
      heading.parentElement.append(probe);
    }
    const measure=document.createElement('canvas').getContext('2d');
    measure.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const spacing=parseFloat(style.letterSpacing)||0;
    const fits=value=>{
      if(probe){probe.textContent=value;return probe.getBoundingClientRect().height<=lineHeight*2+.5;}
      let lines=1,line='';
      for(const letter of Array.from(value)){const next=line+letter;if(line&&measure.measureText(next).width+Array.from(next).length*spacing>width){lines++;line=letter;}else line=next;}
      return lines<=2;
    };
    const parts=[];let remaining=Array.from(text);
    while(remaining.length){
      let low=1,high=remaining.length,limit=1;
      while(low<=high){const middle=Math.floor((low+high)/2);if(fits(remaining.slice(0,middle).join(''))){limit=middle;low=middle+1;}else high=middle-1;}
      if(limit<remaining.length){
        const earliest=Math.max(6,Math.floor(limit*.35));let boundary=-1;
        for(const pattern of [/[。！？；]/u,/[，、]/u]){for(let i=limit-1;i>=earliest;i--)if(pattern.test(remaining[i])){boundary=i;break;}if(boundary>=0)break;}
        if(boundary>=0)limit=boundary+1;
      }
      parts.push(remaining.splice(0,limit).join(''));
    }
    probe?.remove();return {parts,measured:visible};
  }
  function renderCurrent({advancePart=false}={}){
    const item=browsed??current;if(!item)return;
    const phrase=$('#mind-phrase'),context=$('#mind-context');
    const visible=phrase.getClientRects().length>0;
    if(displayedId!==item.id||(!partsMeasured&&visible)){
      const split=splitPhrase(item.phrase);phraseParts=split.parts;partsMeasured=split.measured;partIndex=0;displayedId=item.id;
      nextPartAt=Date.now()+partHold;revealDoneAt=phraseParts.length>1?Date.now()+phraseParts.length*partHold:0;revealPausedAt=0;
    }else if(advancePart&&partIndex<phraseParts.length-1){partIndex++;nextPartAt=Date.now()+partHold;revealDoneAt=nextPartAt+(phraseParts.length-partIndex-1)*partHold;}
    const shown=trim(phraseParts[partIndex]??item.phrase);
    const changed=phrase.textContent!==shown;
    const version=++expressionVersion;
    const commit=()=>{
      if(version!==expressionVersion)return;
      const anchor=$('#experience-list').getBoundingClientRect().top,scroll=host.scrollTop;
      phrase.textContent=shown;phrase.dataset.part=String(partIndex+1);phrase.dataset.parts=String(phraseParts.length);phrase.setAttribute('aria-label',item.phrase);context.textContent=item.context;
      if(scroll>200)host.scrollTop=scroll+$('#experience-list').getBoundingClientRect().top-anchor;
    };
    const surface=advancePart?phrase:$('#mind-expression');
    $('#mind-expression').getAnimations().forEach(a=>a.cancel());phrase.getAnimations().forEach(a=>a.cancel());
    if(changed&&!$('#consciousness-page').hidden&&!$('#sheet').open&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
      const fade=surface.animate([{opacity:1,filter:'blur(0)'},{opacity:0,filter:'blur(5px)'}],{duration:180,easing:'cubic-bezier(.23,1,.32,1)'});
      fade.finished.then(()=>{if(version!==expressionVersion)return;commit();surface.animate([{opacity:0,filter:'blur(5px)'},{opacity:1,filter:'blur(0)'}],{duration:260,easing:'cubic-bezier(.23,1,.32,1)'});}).catch(()=>{});
    }else commit();
    $('#mind-state').textContent=browsed?`${time(item.at)} · ${item.status??'一个片刻'}`:`此刻 · ${item.status??'持续感知'}`;
    $('#mind-state').dataset.state=item.kind==='event'?'event':'idle';
    $('#mind-position').textContent=browsed?'刚才的思考':'此刻的思考';
    const position=browsed?snapshots.findIndex(n=>n.id===browsed.id):0;
    $('#mind-previous').disabled=position===snapshots.length-1;
    $('#mind-next').disabled=!browsed;
    $('#mind-live').hidden=!browsed;
    const updated=Boolean(browsed&&current.kind==='event');
    $('#mind-live').textContent='回到此刻';$('#mind-live').dataset.updated=String(updated);
    $('#mind-live').setAttribute('aria-label',updated?'回到此刻，有新动态':'回到此刻');
  }
  function isVisible(node){return Boolean(node?.isConnected&&node.getClientRects().length&&!node.closest('[hidden]'));}
  function attentionPriority(item){
    if(/未完成|失败|中断|未确认/.test(item.status??''))return 0;
    if(Number.isFinite(item.attentionPriority))return item.attentionPriority;
    if(/设备回应|请求|正在调整|进行中/.test(item.status??'')&&item.scope!=='personal')return 1;
    if(item.tone==='waiting'||/等|待|暂停/.test(item.status??''))return 2;
    return /观察/.test(item.status??'')?3:4;
  }
  function attentionItems(activeEvent=lastEvent){
    const items=new Map();
    for(const item of experiences.values())if(item.state==='active')items.set(item.id,{...item,status:item.status??'还在继续'});
    if(activeEvent&&!activeEvent.cancelled&&(!activeEvent.ended||activeEvent.failed)){
      const stored=experiences.get(activeEvent.id)??{};
      items.set(activeEvent.id,{...stored,id:activeEvent.id,title:activeEvent.failed?'客厅换气还没有完成':'客厅空气正在调整',summary:activeEvent.failed?'设备还没有回应，空气结果尚未确认':activeEvent.paused?'暂时停在这里，当前进度已保留':stored.summary??'继续留意设备反馈和空气变化',status:activeEvent.failed?'未完成':activeEvent.paused?'已暂停':stored.status??'进行中',tone:activeEvent.failed?'waiting':stored.tone??'neutral',scope:stored.scope??'family',updatedAt:stored.updatedAt??clock(),attentionPriority:activeEvent.failed?0:1});
    }
    return [...items.values()].sort((a,b)=>attentionPriority(a)-attentionPriority(b)||(b.updatedAt??0)-(a.updatedAt??0));
  }
  function attentionCardMarkup(item){
    return `<span class="attention-copy"><strong>${esc(item.title)}</strong><small>${esc(item.summary)}</small><span class="attention-meta">${item.scope==='personal'?'<span class="attention-scope">仅自己</span>':''}<time class="attention-time">${moment(item.updatedAt)}</time></span></span><span class="attention-status">${esc(item.status??'还在继续')}</span>${icon('chevron')}`;
  }
  function renderAttentionCards(container,items){
    if(!container)return;
    const ids=new Set(items.map(n=>n.id));
    [...container.children].forEach(node=>{if(!ids.has(node.dataset.attention))node.remove();});
    for(const [index,item] of items.entries()){
      let button=[...container.children].find(node=>node.dataset.attention===item.id);
      if(!button){button=document.createElement('button');button.className='attention-item';button.dataset.attention=item.id;button.onclick=()=>openExperience(item.id);}
      const html=attentionCardMarkup(item);
      if(cardMarkup.get(button)!==html){button.innerHTML=html;cardMarkup.set(button,html);}
      if(container.children[index]!==button)container.insertBefore(button,container.children[index]??null);
    }
  }
  function renderFeatured(item){
    const featured=$('#attention-featured'),signature=item?`${item.id}:${attentionCardMarkup(item)}`:'';
    if(signature===attentionMarkup)return;
    attentionMarkup=signature;const version=++attentionVersion,oldButton=featured.lastElementChild;
    featured.getAnimations().forEach(animation=>animation.cancel());
    [...featured.children].forEach(node=>{node.getAnimations().forEach(animation=>animation.cancel());if(node!==oldButton)node.remove();});
    const animate=item&&oldButton&&oldButton.dataset.attention!==item.id&&isVisible(featured)&&!$('#sheet').open&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(!animate){renderAttentionCards(featured,item?[item]:[]);const button=featured.firstElementChild;if(button){button.style.position='';button.style.inset='';button.style.width='';button.inert=false;}return;}
    const incoming=document.createElement('button');incoming.className='attention-item';incoming.dataset.attention=item.id;incoming.innerHTML=attentionCardMarkup(item);cardMarkup.set(incoming,incoming.innerHTML);incoming.onclick=()=>openExperience(item.id);
    featured.style.position='relative';
    for(const button of [oldButton,incoming])Object.assign(button.style,{position:'absolute',inset:'0',width:'100%'});
    oldButton.inert=true;featured.append(incoming);
    const direction=attentionDirection<0?-1:1;
    const outgoing=oldButton.animate([{transform:'translateX(0)'},{transform:`translateX(${-direction*100}%)`}],{duration:320,easing:'ease',fill:'forwards'});
    const entering=incoming.animate([{transform:`translateX(${direction*100}%)`},{transform:'translateX(0)'}],{duration:320,easing:'ease',fill:'forwards'});
    Promise.allSettled([outgoing.finished,entering.finished]).then(()=>{
      if(version!==attentionVersion)return;
      oldButton.remove();entering.cancel();incoming.style.position='';incoming.style.inset='';incoming.style.width='';
    });
  }
  function renderAttention(activeEvent=lastEvent){
    const attention=$('#mind-attention'),list=$('#attention-list'),summary=$('#attention-summary'),items=attentionItems(activeEvent);
    const oldOrder=[...attentionOrder],reading=isVisible(list),scroller=list?.closest('.attention-page-content')??list;
    const listScroll=scroller?.scrollTop??0;
    const anchor=reading?[...list.children].find(node=>node.dataset.attention&&node.getBoundingClientRect().bottom>scroller.getBoundingClientRect().top):null,anchorTop=anchor?.getBoundingClientRect().top;
    const overviewScroll=host.scrollTop,overviewAnchor=$('#experience-list'),overviewTop=overviewAnchor.getBoundingClientRect().top;
    if(reading){
      const byId=new Map(items.map(n=>[n.id,n]));attentionOrder=attentionOrder.filter(id=>byId.has(id));
      for(const item of items)if(!attentionOrder.includes(item.id)){
        const position=attentionOrder.findIndex(id=>attentionPriority(byId.get(id))>attentionPriority(item));
        attentionOrder.splice(position<0?attentionOrder.length:position,0,item.id);
      }
    }else attentionOrder=items.map(n=>n.id);
    const byId=new Map(items.map(n=>[n.id,n]));
    if(!byId.has(selectedAttentionId)){
      const oldIndex=Math.max(0,oldOrder.indexOf(selectedAttentionId));selectedAttentionId=attentionOrder[Math.min(oldIndex,attentionOrder.length-1)]??null;attentionNextAt=Date.now()+3000;attentionDirection=1;
    }
    attention.hidden=!items.length;
    const index=Math.max(0,attentionOrder.indexOf(selectedAttentionId)),indicator=attention.querySelector('.attention-count');
    indicator.textContent=items.length?`${index+1}/${items.length}`:'0/0';indicator.setAttribute('aria-label',`第${items.length?index+1:0}件，共${items.length}件`);
    renderFeatured(byId.get(selectedAttentionId));
    if(summary){const waiting=items.filter(n=>n.tone==='waiting'||/等|待|暂停|未完成/.test(n.status??'')).length;summary.hidden=!items.length;summary.textContent=items.length?`共${items.length}件${waiting?` · ${waiting}件待继续`:''}`:'';}
    if(list){
      renderAttentionCards(list,attentionOrder.map(id=>byId.get(id)).filter(Boolean));
      if(!items.length&&!list.querySelector('.attention-empty')){const empty=document.createElement('div');empty.className='attention-empty';empty.innerHTML='<h2>这一刻，没有尚未结束的事</h2><p>新的进展会在这里接上，过往的经历保留在日志里</p>';list.append(empty);}
      if(reading&&scroller)scroller.scrollTop=anchor?.isConnected?listScroll+anchor.getBoundingClientRect().top-anchorTop:listScroll;
    }
    if(overviewScroll>200)host.scrollTop=overviewScroll+overviewAnchor.getBoundingClientRect().top-overviewTop;
  }
  function shiftAttention(direction,{manual=true}={}){
    if(manual){attentionManualUntil=Date.now()+3000;attentionNextAt=attentionManualUntil;}
    if(attentionOrder.length<2)return;
    attentionDirection=direction;const index=Math.max(0,attentionOrder.indexOf(selectedAttentionId));selectedAttentionId=attentionOrder[(index+direction+attentionOrder.length)%attentionOrder.length];
    if(!manual)attentionNextAt=Date.now()+3000;
    renderAttention();
  }
  function bindHorizontalSwipe(surface,onSwipe,onInteraction){
    let start=null;
    surface.addEventListener('pointerdown',e=>{if(!e.isPrimary||(e.pointerType==='mouse'&&e.button!==0))return;start={id:e.pointerId,x:e.clientX,y:e.clientY};onInteraction(true);});
    surface.addEventListener('pointermove',e=>{
      if(!start||start.id!==e.pointerId)return;
      const dx=e.clientX-start.x,dy=e.clientY-start.y;
      if(Math.abs(dx)>=36&&Math.abs(dx)>Math.abs(dy)*1.25){if(e.cancelable)e.preventDefault();try{surface.setPointerCapture(e.pointerId);}catch{}}
    });
    surface.addEventListener('pointerup',e=>{
      if(!start||start.id!==e.pointerId)return;
      const dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;onInteraction(false);
      if(Math.abs(dx)<36||Math.abs(dx)<=Math.abs(dy)*1.25)return;
      if(e.cancelable)e.preventDefault();if(surface.id==='attention-featured')attentionSuppressClickUntil=Date.now()+600;
      onSwipe(dx>0?1:-1);
    });
    const endInteraction=()=>{if(start){start=null;onInteraction(false);}};
    surface.addEventListener('pointercancel',endInteraction);
    surface.addEventListener('lostpointercapture',endInteraction);
    surface.addEventListener('pointerleave',e=>{if(!surface.hasPointerCapture(e.pointerId))endInteraction();});
  }
  function attentionCanAdvance(){
    const featured=$('#attention-featured');
    if(attentionGestureActive||document.hidden||$('#sheet').open||$('#consciousness-page').hidden||attentionOrder.length<2||matchMedia('(prefers-reduced-motion: reduce)').matches||!isVisible(featured))return false;
    if(featured.contains(document.activeElement)&&document.activeElement.matches(':focus-visible'))return false;
    const rect=featured.getBoundingClientRect(),viewport=host.getBoundingClientRect();
    return rect.bottom>viewport.top&&rect.top<viewport.bottom&&rect.bottom>0&&rect.top<window.innerHeight;
  }
  function renderExperiences(){
    const list=$('#experience-list');if(!list)return;
    const scroll=host.scrollTop;
    const anchor=[...list.children].find(n=>n.getBoundingClientRect().bottom>host.getBoundingClientRect().top),anchorTop=anchor?.getBoundingClientRect().top;
    const attentionIds=new Set(attentionItems().map(n=>n.id));
    const visible=[...experiences.values()].filter(n=>n.state!=='active'&&!attentionIds.has(n.id)).sort((a,b)=>b.updatedAt-a.updatedAt);
    const retained=new Set(visible.map(n=>n.id));
    [...list.children].forEach(n=>{if(!retained.has(n.dataset.experience))n.remove();});
    for(const [index,item] of visible.entries()){
      let button=[...list.children].find(n=>n.dataset.experience===item.id);
      if(!button){button=document.createElement('button');button.className='experience-card';button.dataset.experience=item.id;button.onclick=()=>openExperience(item.id);}
      const html=`<span class="experience-card-heading"><strong>${esc(item.title)}</strong>${icon('chevron')}</span><span class="experience-summary">${esc(item.summary)}</span><span class="experience-meta"><time>${moment(item.updatedAt)}</time>${item.scope==='personal'?'<span class="personal-scope">仅自己</span>':''}${item.status?`<span class="experience-status" data-tone="${esc(item.tone)}">${esc(item.status)}</span>`:''}</span>`;
      if(cardMarkup.get(button)!==html){button.innerHTML=html;cardMarkup.set(button,html);}
      if(list.children[index]!==button)list.insertBefore(button,list.children[index]??null);
    }
    host.scrollTop=scroll>200&&anchor?.isConnected?scroll+anchor.getBoundingClientRect().top-anchorTop:scroll;
  }
  function entriesFor(id){return logs.filter(n=>n.experienceId===id).sort((a,b)=>a.at-b.at);}
  function entryList(entries,{full=false}={}){
    let group='';const spansDays=new Set(entries.map(row=>dateKey(row.at))).size>1;
    return `<ol class="record-timeline ${full?'full-journal':''}">${entries.map(row=>{
      const date=dayLabel(row.at),newDay=date!==group,heading=full&&newDay?`<li class="journal-day">${date}</li>`:'',dateMark=!full&&spansDays&&newDay?`<span class="record-date">${date}</span>`:'';group=date;
      return `${heading}<li class="record-entry"><time>${dateMark}${time(row.at)}</time><div><strong>${esc(row.label)}</strong><p>${esc(row.text)}</p>${full&&row.scope==='personal'?'<small class="journal-scope">仅自己</small>':''}</div></li>`;
    }).join('')}</ol>`;
  }
  function openExperience(id,{restoreFocus}={}){
    const item=experiences.get(id);
    const restore=restoreFocus??(()=>{
      for(const container of [$('#attention-list'),$('#mind-attention'),$('#experience-list')]){
        if(!isVisible(container))continue;
        const button=[...container.querySelectorAll('[data-experience],[data-attention]')].find(node=>node.dataset.experience===id||node.dataset.attention===id);
        if(button){button.focus({preventScroll:true});return;}
      }
      const fallback=isVisible($('#attention-page'))?$('#attention-back'):isVisible($('#open-attention-list'))?$('#open-attention-list'):$('#open-recent-logs');fallback?.focus({preventScroll:true});
    });
    if(id==='offline-bedroom'){
      openSheet('卧室还在等待连接',`<p class="experience-detail-summary">空调暂时离线，我还没能接上它的近况。自动调温暂不可用</p><p class="experience-detail-note">可以检查设备电源和网络，连接恢复后再继续</p>${entryList(entriesFor(id))}`,{restoreFocus:restore});
    }else if(item){
      openSheet(item.title,`<div class="experience-detail-meta"><span>${moment(item.updatedAt)}</span>${item.scope==='personal'?'<span>仅自己可见</span>':''}${item.status?`<span>${esc(item.status)}</span>`:''}</div><p class="experience-detail-summary">${esc(item.summary)}</p>${entryList(entriesFor(id))}`,{restoreFocus:restore});
    }
    $('#sheet').dataset.content='experience';
  }
  function openCurrentDetail(){
    const item={...(browsed??current)};if(!item.phrase)return;
    const position=snapshots.findIndex(n=>n.id===item.id);
    const earlier=(position>=0?snapshots.slice(position+1):snapshots).filter(n=>n.id!==item.id).map(n=>({...n}));
    const progress=item.eventId?entriesFor(item.eventId).filter(n=>!browsed||n.at<=item.at).map(n=>({...n})):[];
    const history=earlier.length?`<section class="expression-history" aria-labelledby="expression-history-title"><h3 id="expression-history-title">刚才的思考</h3><ol class="expression-records">${earlier.map(n=>`<li class="expression-record"><div class="expression-record-meta"><time>${moment(n.at)}</time><span>${esc(n.status??'一个片刻')}</span>${n.scope==='personal'?'<span>仅自己</span>':''}</div><p class="expression-record-phrase">${esc(n.phrase)}</p>${n.context?`<p class="expression-record-context">${esc(n.context)}</p>`:''}</li>`).join('')}</ol></section>`:'';
    openSheet('小元的思考',`<section class="expression-reading" aria-label="${browsed?'正在回看的思考':'此刻的思考'}"><div class="experience-detail-meta"><span>${browsed?moment(item.at):'此刻'}</span><span>${esc(item.status??'持续感知')}</span>${item.scope==='personal'?'<span>仅自己可见</span>':''}</div><p class="experience-detail-summary">${esc(item.phrase)}</p><p class="experience-detail-note">${esc(item.context)}</p>${item.more?`<p class="experience-detail-note">${esc(item.more)}</p>`:''}</section>${progress.length?`<section class="expression-progress"><h3>这件事的进展</h3>${entryList(progress)}</section>`:''}${history}`,{restoreFocus:()=>$('#mind-expand').focus({preventScroll:true})});
    $('#sheet').dataset.content='expression';
  }
  function openLogs({restoreFocus}={}){
    const snapshot=[...logs].sort((a,b)=>b.at-a.at);
    openSheet('最近日志',entryList(snapshot,{full:true}),{restoreFocus:restoreFocus??(()=>$('#open-recent-logs').focus({preventScroll:true}))});
    $('#sheet').dataset.content='journal';
    $('#sheet-body').scrollTop=0;
  }
  renderAttention();renderExperiences();
  setInterval(()=>{
    const now=Date.now(),paused=document.hidden||$('#consciousness-page').hidden||$('#sheet').open;
    if(paused){if(!revealPausedAt)revealPausedAt=now;return;}
    if(revealPausedAt){nextPartAt+=now-revealPausedAt;revealDoneAt+=now-revealPausedAt;revealPausedAt=0;}
    if(partIndex<phraseParts.length-1&&now>=nextPartAt)renderCurrent({advancePart:true});
  },100);
  setInterval(()=>{
    const now=Date.now();
    if(!attentionCanAdvance()){attentionWasPaused=true;return;}
    if(attentionWasPaused){attentionNextAt=now+3000;attentionWasPaused=false;}
    if(now<attentionManualUntil)return;
    if(now>=attentionNextAt)shiftAttention(1,{manual:false});
  },100);
  const refreshAttention=()=>{renderAttention(lastEvent);renderExperiences();};
  return {getServices:()=>[...experiences.values()].map(value=>({...value})),getRecords:()=>logs.map(value=>({...value})),record,updateCurrent,refresh:refreshAttention,refreshAttention,openLogs,openExperience,isRevealing:()=>!browsed&&displayedId===current?.id&&phraseParts.length>1&&Date.now()<revealDoneAt};
}
