import {createMemoryStore} from './memory-store.js?v=care-card-actions-20261021';
import {createWeatherPreview} from './weather.js?v=weather-preview-20261019';
import {previewNow} from './preview-clock.js';
import {createMinePage} from './mine.js?v=privacy-terms-20261021';
import {createPeoplePage} from './people.js?v=scene-coldstart-20261020';
import {createMemoryPage} from './memory.js?v=memory-chat-20261016';
import {createDeviceDetail} from './device-detail.js?v=source-data-20261019';
import {createHomeContext} from './home-context.js?v=family-overview-copy-20261022-2';
import {createHomeServices} from './home-services.js?v=event-adjustment-20261022';
import {createConsciousness,getIdleExpression} from './consciousness.js?v=care-card-actions-20261021';
import {createConversation} from './conversation.js?v=care-actions-20261020';
import {createDeviceStore} from './device-store.js?v=native-spatial-20261021';
import {createDevicesPage} from './devices.js?v=family-overview-copy-20261022-2';
import {createDeviceSettings} from './device-settings.js?v=native-20261021';
import {createDeviceConnections} from './device-connections.js?v=mine-figma-20261016-2';
import {createDeviceOnboarding} from './device-onboarding.js?v=native-protocol-copy-20261021';
const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const roomSeed=[
  {id:'living',name:'客厅',color:'#6bbcff',presence:'2人在场',activity:'安静停留',devices:4,temperature:25,humidity:48,airQuality:'优质',source:'空间感知与环境传感器',observed:true},
  {id:'master',name:'主卧',color:'#9fa0ff',presence:'1人在场',activity:'休息',devices:2,temperature:24,humidity:51,airQuality:'优质',source:'空间感知与环境传感器',observed:true},
  {id:'second',name:'次卧',color:'#82aaff',presence:'1人在场',activity:'阅读',devices:1,temperature:25,humidity:46,airQuality:'正常',source:'空间感知与环境传感器',observed:true},
  {id:'bathroom',name:'卫生间',color:'#aa8aff',presence:'未检测到人在场',activity:'暂无活动证据',devices:1,temperature:24,humidity:58,airQuality:'正常',source:'空间感知与环境传感器',observed:true},
  {id:'kitchen',name:'厨房',color:'#60cfc9',presence:'未检测到人在场',activity:'暂无活动证据',devices:2,temperature:26,humidity:53,airQuality:'正常',source:'空间感知与环境传感器',observed:true},
  {id:'dining',name:'餐厅',color:'#73d1d1',presence:'1人在场',activity:'用餐',devices:1,temperature:25,humidity:49,airQuality:'优质',source:'空间感知与环境传感器',observed:true}
].map(room=>({...room,environment:roomEnvironment(room)}));
function roomEnvironment(room){return [Number.isFinite(room.temperature)?`${room.temperature}℃`:null,Number.isFinite(room.humidity)?`${room.humidity}%`:null,room.airQuality?`空气${room.airQuality}`:null].filter(Boolean).join(' · ');}
let rooms=structuredClone(roomSeed),selected='living',interacting=false,pausedUntil=0,lastCarousel=Date.now(),lastThought=Date.now(),thoughtIndex=0,event=null,eventTimer=null,receiptTimer=null,voiceTimer=null,controlTimer=null,toastTimer=null,previousFocus=null,scene='normal';
let consciousness=null,conversation=null,eventSerial=0;
let deviceStore=null,devicesPage=null,deviceSettings=null,deviceOnboarding=null,deviceConnections=null,deviceDetail=null,memoryStore=null,memoryPage=null,spaceReturn='home';
let minePage=null,peoplePage=null,peopleReturn=null,homeContext=null,homeServices=null,homeDeviceReturn=null,homeConversationReturn=null;
const modeDeviceParents=new Map();
const sceneControlRequests=new Map();
const serviceAdjustments=new Map();
const careRestoreParents=new Map();
const careEventParents=new Map();
let receiptVersion=0,pendingReceipt=null,lampLevel=60,airMode='标准',deviceSampleIndex=0,nextDeviceSampleAt=Date.now()+8000;
const SPACE_HOLD_MS=4000,RECEIPT_HOLD_MS=3500;
const idleThoughts=Array.from({length:8},(_,index)=>getIdleExpression(index,rooms).phrase);
let thoughtVersion=0,currentThoughtText=$('#thought').textContent;
async function setThought(text,{animate=true}={}){
  text=String(text).replace(/[。．.]+$/u,'');
  currentThoughtText=text;
  const paragraph=$('#thought'),version=++thoughtVersion;
  paragraph.getAnimations().forEach(a=>a.cancel());
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const visible=paragraph.getClientRects().length>0;
  function commit(){
    paragraph.textContent=text;
    consciousness?.updateCurrent(currentExpression(text));
  }
  if(!animate||reduce||!visible||paragraph.textContent===text){commit();return;}
  const fadeOut=paragraph.animate([{opacity:1,filter:'blur(0px)'},{opacity:0,filter:'blur(6px)'}],{duration:180,easing:'cubic-bezier(.23,1,.32,1)',fill:'forwards'});
  try{await fadeOut.finished;}catch{return;}
  if(version!==thoughtVersion)return;
  commit();fadeOut.cancel();
  const fadeIn=paragraph.animate([{opacity:0,filter:'blur(6px)'},{opacity:1,filter:'blur(0px)'}],{duration:260,easing:'cubic-bezier(.23,1,.32,1)',fill:'forwards'});
  try{await fadeIn.finished;if(version===thoughtVersion)fadeIn.cancel();}catch{}
}
const sheet=$('#sheet');
let cardRoom=null,cardSlot=0;
function positionSpaceState(points,box){
  const point=points[selected];if(!point)return;
  const card=$('#space-state'),cw=card.offsetWidth||100,ch=card.offsetHeight||60;
  const candidates=[[point.x+40,point.y-28-ch],[point.x-cw-40,point.y-28-ch],[point.x+40,point.y+42],[point.x-cw-40,point.y+42],[point.x+32,point.y-ch/2],[point.x-cw-32,point.y-ch/2]].map(([x,y])=>({x:Math.max(4,Math.min(box.width-cw-14,x)),y:Math.max(14,Math.min(box.height-ch-4,y))}));
  const occupied=[...$('#graph-hit-layer').children].map(button=>{
    const q=points[button.dataset.room],half=Math.max(24,button.firstElementChild.offsetWidth/2+4);
    return {left:q.x-half,right:q.x+half,top:q.y-24,bottom:q.y+(button.dataset.room==='core'?50:38)};
  });
  const overlap=p=>occupied.reduce((area,r)=>area+Math.max(0,Math.min(p.x+cw+10,r.right)-Math.max(p.x,r.left))*Math.max(0,Math.min(p.y+ch,r.bottom)-Math.max(p.y-12,r.top)),0);
  const ranked=candidates.map((p,i)=>({...p,i,score:overlap(p)})).sort((a,b)=>a.score-b.score||a.i-b.i);
  if(cardRoom!==selected||interacting&&overlap(candidates[cardSlot])>ranked[0].score+180){cardSlot=ranked[0].i;cardRoom=selected;}
  const best=candidates[cardSlot],scale=window.devicePixelRatio||1;card.style.left=`${Math.round(best.x*scale)/scale}px`;card.style.top=`${Math.round((best.y+ch)*scale)/scale}px`;
}
// Shared room-management callbacks retain their adapter; the homepage uses the new overview.
const graph={select(){},setRooms(){},setPaused(){},reset(){}};
graph.select(selected);
function renderState(){
  const r=rooms.find(r=>r.id===selected);if(!r)return;
  const presence=r.presence==='未检测到人在场'?'未检测到人':r.presence,activity=r.activity==='暂无活动证据'?'暂无活动':r.activity;
  const primary=!r.observed?(r.source==='手动创建'?'待接入':'待更新'):`${presence} · ${activity}`;
  const eventActive=event&&!event.cancelled&&(!event.ended||event.failed)&&r.id==='living';
  const secondary=!r.observed?(r.source==='手动创建'?'暂无数据':'空间已保存'):eventActive?r.environment:roomEnvironment(r);
  $('#space-state-primary').textContent=primary;$('#space-state-secondary').textContent=secondary;
  $('#space-state').dataset.sensing=r.observed?'available':'waiting';
  $('#space-state').setAttribute('aria-label',`查看${r.name}详情`);graph.select(selected);lastCarousel=Date.now();
}
function toast(message){
  clearTimeout(toastTimer);$('#toast').hidden=true;
  let target=$('#toast');
  if(sheet.open){target=sheet.querySelector('.sheet-feedback');if(!target){target=document.createElement('p');target.className='sheet-feedback';target.setAttribute('role','status');$('#sheet-body').append(target);}}
  target.textContent=message;target.hidden=false;toastTimer=setTimeout(()=>target.hidden=true,2600);
}
function uiIcon(name){
  const paths={
    detail:'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h4"/>',
    back:'<path d="m14 5-7 7 7 7"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',plus:'<path d="M12 5v14M5 12h14"/>',chevron:'<path d="m9 5 7 7-7 7"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',edit:'<path d="m15 4 5 5M4 20l4-1 12-12a2 2 0 0 0-4-4L4 15v5Z"/>',trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/>',reset:'<path d="M4 9a8 8 0 1 1 0 7M4 4v5h5"/>',model:'<path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/>',room:'<path d="M4 9 12 3l8 6v11H4V9ZM9 20v-7h6v7"/>',living:'<path d="M6 12V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5M4 11h2v5h12v-5h2v8H4v-8ZM6 19v2M18 19v2"/>',bed:'<path d="M4 20V5M20 20V9M4 16h16M4 9h12a4 4 0 0 1 4 4v3M7 9V6h5v3"/>',bathroom:'<path d="M12 3c-2 3-7 8-7 12a7 7 0 0 0 14 0c0-4-5-9-7-12ZM8 15a4 4 0 0 0 4 4"/>',kitchen:'<path d="M5 10h14v5a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5v-5ZM3 10h18M7 6V3M12 6V3M17 6V3"/>',dining:'<path d="M5 3v6a2 2 0 0 0 4 0V3M7 3v18M17 3c-3 2-3 6-3 9h4M18 3v18"/>'
  };
  return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]??paths.room}</svg>`;
}
const homeVisible=()=>!$('#app').dataset.view;
let cancelSheet=()=>sheet.close(),sheetFocusReturn=null;
function updateDialogFrame(){document.documentElement.style.setProperty('--frame-top',`${$('#app').getBoundingClientRect().top}px`);}
function openSheet(title,content,{variant='sheet',onCancel=null,initialFocus=null,restoreFocus=null}={}){
  homeContext?.setPaused(true);
  clearTimeout(voiceTimer);clearTimeout(toastTimer);$('#toast').hidden=true;hideReceipt();
  if(!sheet.open){previousFocus=document.activeElement;sheetFocusReturn=restoreFocus;}
  else if(restoreFocus)sheetFocusReturn=restoreFocus;
  cancelSheet=onCancel??(()=>sheet.close());sheet.dataset.variant=variant;delete sheet.dataset.content;updateDialogFrame();
  $('#sheet-body').innerHTML=`${variant==='sheet'?'<div class="sheet-handle" aria-hidden="true"></div>':''}<div class="sheet-header"><h2 id="sheet-title">${esc(title)}</h2><button class="close-button" aria-label="关闭">${uiIcon('close')}</button></div>${content}${variant==='sheet'?'<span class="modal-home-indicator" aria-hidden="true"></span>':''}`;
  sheet.querySelector('.sheet-actions')?.remove();
  if(variant==='sheet'){
    const actions=[...$('#sheet-body').children].filter(node=>node.matches('.dialog-actions,.primary-button'));
    if(actions.length){const footer=document.createElement('div');footer.className='sheet-actions';actions.forEach(node=>footer.append(node));sheet.append(footer);}
  }
  $('#sheet-body').scrollTop=0;
  sheet.setAttribute('aria-labelledby','sheet-title');if(!sheet.open)sheet.showModal();
  graph.setPaused(true);sheet.querySelector('.close-button').onclick=()=>cancelSheet();pausedUntil=Date.now()+15000;
  const target=initialFocus?sheet.querySelector(initialFocus):sheet.querySelector('.close-button');target?.focus({preventScroll:true});if(target?.tagName==='INPUT'&&target.type==='text')target.select();
}
sheet.addEventListener('close',()=>{
  if(sheet.open)return;homeContext?.setPaused(false);clearTimeout(voiceTimer);graph.setPaused(!homeVisible());pausedUntil=Date.now()+15000;
  if(sheetFocusReturn)sheetFocusReturn();else if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
  sheetFocusReturn=null;flushReceipt();
});
sheet.addEventListener('cancel',e=>{e.preventDefault();cancelSheet();});
sheet.addEventListener('click',e=>{if(e.target===sheet){const r=sheet.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)cancelSheet();}});
window.addEventListener('resize',()=>{if(sheet.open)updateDialogFrame();});
function setView(view){
  if(sheet.open)sheet.close();hideReceipt();
  homeContext?.onViewChange(view);
  homeServices?.onViewChange(view);
  deviceSettings?.onViewChange(view);
  devicesPage?.onViewChange(view);
  deviceOnboarding?.onViewChange(view);
  deviceDetail?.onViewChange(view);
  memoryPage?.onViewChange(view);
  minePage?.onViewChange(view);
  peoplePage?.onViewChange(view);
  if(view==='home')delete $('#app').dataset.view;else $('#app').dataset.view=view;
  $('#space-management-page').hidden=view!=='spaces';$('#consciousness-page').hidden=view!=='consciousness';$('#attention-page').hidden=view!=='attention';
  $('#home-services-page').hidden=view!=='home-services';
  $('#devices-page').hidden=view!=='devices';$('#device-settings-page').hidden=view!=='device-settings';
  $('#device-onboarding-page').hidden=view!=='device-onboarding';
  $('#device-detail-page').hidden=view!=='device-detail';
  $('#memory-page').hidden=view!=='memory';$('#memory-detail-page').hidden=view!=='memory-detail';
  $('#mine-page').hidden=view!=='profile';$('#mine-detail-page').hidden=view!=='profile-detail';$('#people-page').hidden=view!=='people';
  conversation?.onViewChange();
  const mainView=view==='home'||view==='devices'||view==='memory'||view==='profile';
  $('#home-screen').inert=view!=='home';$('.tabbar').inert=!mainView;$('.tabbar').hidden=!mainView;
  document.querySelectorAll('[data-tab]').forEach(button=>{if(button.dataset.tab===view)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
  $('[data-tab="devices"] img').src=view==='devices'?'assets/device-nav-device-ref.svg':'assets/nav-devices.svg';
  graph.setPaused(view!=='home');
}
function syncDeviceCounts(){
  if(!deviceStore)return;const list=deviceStore.getDevices();
  rooms.forEach(room=>room.devices=list.filter(device=>device.roomId===room.id).length);
  if(!$('#space-management-page').hidden)renderManage();
  homeContext?.refresh();
}

function syncRooms(){homeContext?.refresh();homeServices?.refresh();if(!rooms.some(r=>r.id===selected))selected=rooms[0].id;syncDeviceCounts();graph.setRooms(rooms);renderState();if(!$('#space-management-page').hidden)renderManage();devicesPage?.refresh();deviceSettings?.refresh();memoryPage?.refresh();pausedUntil=Date.now()+15000;}
function renderManage(){
  const total=rooms.reduce((n,r)=>n+r.devices,0);
  $('#space-management-content').innerHTML=`<div class="space-page-intro"><h2>${esc($('#home-title').textContent)}</h2><span>${rooms.length} 个空间 · ${total} 台设备</span></div><div class="space-list">${rooms.map(r=>`<button class="space-list-item" data-space="${r.id}" aria-label="管理${esc(r.name)}"><span class="room-icon" style="color:${r.color}">${uiIcon(['master','second'].includes(r.id)?'bed':r.id)}</span><span class="space-list-copy"><strong>${esc(r.name)}</strong><small>${r.devices} 台设备 · ${r.observed?'感知可用':r.source==='手动创建'?'待接入':'待更新'}</small></span>${uiIcon('chevron')}</button>`).join('')}</div><button class="model-entry" id="view-model"><span class="model-entry-copy"><span class="model-entry-title">${uiIcon('model')}<strong>空间建模</strong></span><small>查看家庭空间结构</small><span class="model-entry-link">查看模型 ${uiIcon('chevron')}</span></span><img src="assets/space-floorplan.png" alt="家庭空间模型"></button>`;
  $('#space-management-content').querySelectorAll('[data-space]').forEach(b=>b.onclick=()=>openRoom(b.dataset.space));$('#view-model').onclick=openModel;
}
function openManage(){spaceReturn=$('#app').dataset.view==='devices'?'devices':$('#app').dataset.view==='profile-detail'?'profile':'home';setView('spaces');renderManage();$('#space-management-content').scrollTop=0;$('#spaces-back').setAttribute('aria-label',spaceReturn==='profile'?'返回家庭与成员':spaceReturn==='devices'?'返回设备':'返回首页');$('#spaces-back').focus({preventScroll:true});window.scrollTo(0,0);}
function restoreRoomFocus(id){
  if($('#app').dataset.view==='device-settings'){const trigger=$('#device-settings-page').querySelector(`[data-settings-room="${id}"]`)||$('#device-settings-page [data-settings-action="add-room"]')||$('#device-settings-page [data-settings-action="back"]');trigger?.focus({preventScroll:true});return;}
  const trigger=$('#space-management-content').querySelector(`[data-space="${id}"]`);if(!$('#space-management-page').hidden&&trigger)trigger.focus({preventScroll:true});else ($('#home-context .hc-room-status')||$('#voice-entry')).focus({preventScroll:true});
}
function editRoom(id,{returnTo=null}={}){
  const r=rooms.find(r=>r.id===id),cancel=returnTo??(()=>sheet.close());
  openSheet(r?'修改空间名称':'添加空间',`<form id="room-form" novalidate><label class="form-label" for="room-name">空间名称</label><input class="text-input" id="room-name" type="text" maxlength="12" value="${esc(r?.name??'')}" placeholder="例如：书房" autocomplete="off" aria-describedby="room-name-hint room-error"><p class="form-error" id="room-error" role="alert"></p><p class="field-hint" id="room-name-hint">${r?'名称会同步到首页和设备列表。':'添加后可为这个空间分配设备。'}</p><div class="dialog-actions"><button class="secondary-button" type="button" id="cancel-room">取消</button><button class="primary-button" type="submit">${r?'保存修改':'添加空间'}</button></div></form>`,{variant:'float',onCancel:cancel,initialFocus:'#room-name',restoreFocus:()=>restoreRoomFocus(r?.id)});
  $('#cancel-room').onclick=cancel;
  $('#room-name').oninput=()=>{$('#room-error').textContent='';$('#room-name').removeAttribute('aria-invalid');};
  $('#room-form').onsubmit=e=>{
    e.preventDefault();const name=$('#room-name').value.trim(),key=n=>n.normalize('NFKC').toLocaleLowerCase();
    const fail=message=>{$('#room-error').textContent=message;$('#room-name').setAttribute('aria-invalid','true');$('#room-name').focus();};
    if(!name){fail('请填写空间名称');return;}if([...name].length>12){fail('空间名称不能超过12个字');return;}
    if(rooms.some(n=>key(n.name)===key(name)&&n.id!==id)){fail('已有同名空间，请换一个名称');return;}
    if(!r&&rooms.length>=10){fail('空间数量已达上限（10个）');return;}
    const previousName=r?.name;
    if(r)r.name=name;else rooms.push({id:crypto.randomUUID(),name,color:'#8da9df',presence:'感知待接入',activity:'等待空间信息',devices:0,environment:'等待环境数据',source:'手动创建',observed:false});
    if(previousName!==name)consciousness.record({label:r?'空间名称已修改':'添加了一个空间',text:r?`你将${previousName}改名为${name}，空间和设备归属保留`:`你添加了${name}，空间结构已保存，感知信息仍待接入`});
    syncRooms();if(returnTo)returnTo();else sheet.close();toast(r?'空间名称已更新':'空间已添加');
  };
}
function confirmDelete(r,{returnTo=null}={}){
  if(rooms.length<=1){toast('家庭至少保留一个空间');return;}
  const others=rooms.filter(n=>n.id!==r.id),cancel=returnTo??(()=>sheet.close()),hasDevices=r.devices>0;
  const serviceImpact=r.id==='living'&&event&&!event.ended?'<p class="delete-impact">当前空气调整服务将结束，已发生的记录会保留。</p>':'';
  openSheet(`删除${r.name}`,`<p class="sheet-description">${hasDevices?`删除后，${r.devices} 台设备需要移至其他空间。`:'删除后，首页将移除这个空间。'}</p>${hasDevices?`<fieldset class="transfer-group"><legend>选择设备的新空间</legend>${others.map(n=>`<label class="transfer-option"><input type="radio" name="move-to" value="${n.id}"><span class="transfer-copy"><strong>${esc(n.name)}</strong><small>${n.devices} 台设备</small></span><span class="radio-mark" aria-hidden="true"></span></label>`).join('')}</fieldset><p class="delete-impact">只删除空间，设备和已有记录会保留。</p>`:''}${serviceImpact}<div class="dialog-actions"><button class="secondary-button" id="cancel-delete">取消</button><button class="primary-button destructive-button" id="confirm-delete" ${hasDevices?'disabled':''}>${hasDevices?'移动设备并删除':'删除空间'}</button></div>`,{variant:hasDevices?'sheet':'float',onCancel:cancel,restoreFocus:()=>restoreRoomFocus(r.id)});
  sheet.querySelectorAll('[name="move-to"]').forEach(input=>input.onchange=()=>$('#confirm-delete').disabled=false);$('#cancel-delete').onclick=cancel;
  $('#confirm-delete').onclick=()=>{
    const target=hasDevices?rooms.find(n=>n.id===sheet.querySelector('[name="move-to"]:checked')?.value):null;
    if(hasDevices&&!target)return;
    const count=r.devices;if(target){const result=deviceStore?.moveRoomDevices(r.id,target.id);if(result&&!result.ok){toast(result.message);return;}}
    if(r.id==='living'){clearTimeout(controlTimer);pendingReceipt=null;clearEvent(true);}
    rooms=rooms.filter(n=>n.id!==r.id);consciousness.record({label:'空间已移除',text:target?`你移除了${r.name}，${count}台设备移至${target.name}，已有记录保留`:`你移除了${r.name}，已有记录保留`});syncRooms();sheet.close();toast(target?`空间已删除，${count} 台设备已移至${target.name}`:'空间已删除');
  };
}
function openModel(){
  openSheet('空间建模',`<p class="sheet-description">查看家庭空间结构，了解各空间的对应关系。</p><div class="model-preview"><img src="assets/space-floorplan.png" alt="家庭空间模型"></div><div class="model-summary"><span>${rooms.length} 个空间</span><span>${rooms.reduce((n,r)=>n+r.devices,0)} 台设备</span></div><div class="model-room-tags">${rooms.map(r=>`<span><i style="background:${r.color}"></i>${esc(r.name)}</span>`).join('')}</div><button class="primary-button" id="model-done">完成</button>`,{restoreFocus:()=>$('#view-model').focus({preventScroll:true})});$('#model-done').onclick=()=>sheet.close();
}
function openRoom(id=selected){
  const r=rooms.find(room=>room.id===id);if(!r)return;
  const sources=deviceStore?.getDevices().filter(device=>device.roomId===id&&device.type==='environment')||[];
  const live=sources.find(device=>device.online&&device.permissions.read),stale=sources.length>0&&!live;
  const read=key=>live?.readings?.find(value=>value.key===key)?.value;
  const temperature=stale?null:read('temperature')??r.temperature,humidity=stale?null:read('humidity')??r.humidity;
  const airState=stale?'待更新':r.airQuality||'待更新',source=stale?'环境来源离线':live?.name||r.source;
  const returnTo=selector=>{openRoom(id);sheet.querySelector(selector)?.focus({preventScroll:true});};
  openSheet(r.name,`<div class="detail-grid"><div><span>当前活动</span><strong>${esc(r.observed?r.presence+' · '+r.activity:'等待感知更新')}</strong></div><div><span>已关联设备</span><strong>${r.devices} 台</strong></div><div><span>温度</span><strong>${Number.isFinite(temperature)?temperature+'℃':'待更新'}</strong></div><div><span>湿度</span><strong>${Number.isFinite(humidity)?humidity+'%':'待更新'}</strong></div><div><span>空气状态</span><strong>${esc(airState)}</strong></div><div><span>信息来源</span><strong>${esc(source||'等待接入')}</strong></div></div>${stale?'<p class="field-hint">保留最后一次信息，连接恢复前不将旧读数当作当前状态。</p>':''}<div class="space-action-list"><button id="room-edit">${uiIcon('edit')}<span>修改名称</span>${uiIcon('chevron')}</button><button id="delete-room" class="danger" ${rooms.length<=1?'disabled':''}>${uiIcon('trash')}<span>删除空间</span>${uiIcon('chevron')}</button></div>`,{restoreFocus:()=>restoreRoomFocus(r.id)});
  $('#room-edit').onclick=()=>editRoom(r.id,{returnTo:()=>returnTo('#room-edit')});
  $('#delete-room').onclick=()=>confirmDelete(r,{returnTo:()=>returnTo('#delete-room')});
}

function confirmResetLayout(){
  openSheet('恢复默认布局',`<p class="sheet-description">节点将恢复到默认位置，空间名称和设备归属保持不变。</p><div class="dialog-actions"><button class="secondary-button" id="cancel-reset">取消</button><button class="primary-button" id="confirm-reset">恢复布局</button></div>`,{variant:'float'});
  $('#cancel-reset').onclick=()=>sheet.close();$('#confirm-reset').onclick=()=>{graph.reset();consciousness.record({label:'图谱布局已恢复',text:'你恢复了空间节点的默认位置，空间结构与设备归属保留'});sheet.close();toast('图谱布局已恢复');};
}
function openFamilyName({returnTo=null}={}){
  openSheet('家庭名称',`<form id="house-form" novalidate><label class="form-label" for="house-name">显示名称</label><input id="house-name" class="text-input" type="text" maxlength="12" value="${esc($('#home-title').textContent)}" autocomplete="off" aria-describedby="house-error"><p id="house-error" class="form-error" role="alert"></p><div class="dialog-actions"><button class="secondary-button" type="button" id="cancel-house">取消</button><button class="primary-button" type="submit">保存名称</button></div></form>`,{variant:'float',initialFocus:'#house-name',onCancel:returnTo});
  $('#house-name').oninput=()=>{$('#house-error').textContent='';$('#house-name').removeAttribute('aria-invalid');};
  $('#cancel-house').onclick=returnTo??(()=>sheet.close());$('#house-form').onsubmit=e=>{e.preventDefault();const name=$('#house-name').value.trim();if(!name){$('#house-error').textContent='请填写家庭名称';$('#house-name').setAttribute('aria-invalid','true');$('#house-name').focus();return;}const oldName=$('#home-title').textContent;$('#home-title').textContent=name;if(oldName!==name)consciousness.record({label:'家庭名称已更新',text:`你将${oldName}改名为${name}`});if(!$('#space-management-page').hidden)renderManage();devicesPage?.refresh();if(returnTo)returnTo();else sheet.close();toast('家庭名称已更新');};
}
function openFamilySettings(){
  openSheet('家庭设置',`<div class="space-action-list"><button id="settings-name">${uiIcon('room')}<span>家庭名称</span>${uiIcon('chevron')}</button><button id="settings-spaces">${uiIcon('model')}<span>空间管理</span>${uiIcon('chevron')}</button><button id="settings-layout">${uiIcon('reset')}<span>图谱布局</span>${uiIcon('chevron')}</button>${new URLSearchParams(location.search).has('scenarios')?'<button id="settings-scenes">家庭动态</button>':''}</div>`);
  $('#settings-name').onclick=()=>openFamilyName({returnTo:openFamilySettings});$('#settings-spaces').onclick=openManage;$('#settings-layout').onclick=confirmResetLayout;if($('#settings-scenes'))$('#settings-scenes').onclick=openScenes;
}
const eventStages=[
  {phrase:'客厅空气有点闷。',environment:'空气持续变差',status:'发现变化',line:'发现 CO₂ 持续上升',detail:'CO₂ 由 750 ppm 升至 1150 ppm，客厅有人在场。'},
  {phrase:'我会慢慢调整，尽量不打扰。',environment:'正在准备调整',status:'准备调整',line:'选择低噪换气',detail:'结合空气变化与已有授权，选择低噪方式调整。'},
  {phrase:'我正在启动换气，等设备回应。',environment:'等待设备反馈',status:'请求已发送',line:'已发送启动请求',detail:'已经发出启动请求，正在等待设备回应。'},
  {phrase:'新风已经轻轻运转。',environment:'正在观察变化',status:'设备已反馈',line:'设备确认低噪运行',detail:'新风已反馈低噪运行，我会继续观察客厅空气。'},
  {phrase:'空气正在恢复。',environment:'空气正在改善',status:'正在验证',line:'观察到 CO₂ 持续回落',detail:'CO₂ 回落至 900 ppm，继续观察趋势。'},
  {phrase:'客厅空气回稳了。',environment:'空气平稳',status:'结果已验证',line:'确认客厅空气回稳',detail:'CO₂ 回落至 790 ppm，完成本次环境验证。'}
];
function startEvent(mode='air',{source='home'}={}){
  const living=rooms.find(r=>r.id==='living');if(!living){toast('客厅空间已移除，请先确认设备归属');return;}
  if(event&&!event.ended)clearEvent(true);
  clearTimeout(eventTimer);scene=mode;event={id:`air-event-${++eventSerial}`,stage:0,mode,source,paused:false,history:[],ended:false};selected='living';graph.select(selected);pausedUntil=Infinity;$('#task-dot').hidden=false;advanceEvent();
}
function advanceEvent(){
  if(!event||event.paused||event.ended)return;const s=eventStages[event.stage];const living=rooms.find(r=>r.id==='living');if(!living)return;
  if(event.mode==='failed'&&event.stage===3){event.ended=true;event.failed=true;event.history.push({line:'设备还没有回应',detail:'设备连接中断，换气还没能完成。'});living.environment='调整未完成';setThought('设备暂时没有回应，我还在留意。');}else{event.history.push({line:s.line,detail:s.detail});living.environment=s.environment;setThought(s.phrase);if(event.stage===5)event.ended=true;}
  const entry=event.history.at(-1);
  consciousness.record({experienceId:event.id,title:'客厅空气的这次变化',summary:event.failed?'设备没有回应，换气还没能完成。我会继续留意客厅空气':event.ended?'低噪换气后，客厅空气回稳了，环境结果已确认':s.phrase,status:event.failed?'未完成':s.status,tone:event.failed?'waiting':event.ended?'good':'neutral',state:event.ended?'past':'active',label:entry.line,text:entry.detail});
  conversation?.updateAir(event);
  renderState();if(!$('#consciousness-page').hidden)renderConsciousness();
  $('#task-dot').hidden=event.ended&&!event.failed;
  if(event.stage===3&&!event.failed)showReceipt({kind:'air',name:'客厅新风',summary:'已切至低噪模式',image:'assets/air-device.png'});
  if(!event.ended){eventTimer=setTimeout(()=>{if(document.hidden){scheduleResume();return;}event.stage++;advanceEvent();},4800);}else{pausedUntil=Date.now()+15000;if(!event.failed){const finished=event;setTimeout(()=>{if(event!==finished)return;thoughtIndex=0;lastThought=Date.now();setThought(getIdleExpression(0,rooms).phrase);},4200);}}
}
function scheduleResume(){eventTimer=setTimeout(()=>{if(!event||event.paused||event.ended)return;if(document.hidden){scheduleResume();return;}event.stage++;advanceEvent();},1000);}
function clearEvent(keepHistory=false){
  clearTimeout(eventTimer);scene='normal';
  if(event&&!event.ended){consciousness.record({experienceId:event.id,title:'客厅空气的这次变化',summary:'这次调整已经结束，已发生的过程会保留。空气结果还没有确认',status:'已结束',tone:'waiting',label:'本次处理结束',text:'本次处理已结束，已发生的请求和反馈会保留，空气结果仍待确认'});event.ended=true;event.cancelled=true;}
  conversation?.updateAir(event);
  if(!keepHistory)event=null;
  const living=rooms.find(r=>r.id==='living');if(living)living.environment=keepHistory?'结果待确认':'空气平稳';
  thoughtIndex=0;lastThought=Date.now();setThought(getIdleExpression(0,rooms).phrase);$('#task-dot').hidden=!event||event.cancelled;pausedUntil=Date.now()+15000;renderState();if(!$('#consciousness-page').hidden)renderConsciousness();
}
function currentExpression(text=currentThoughtText){
  const item=getIdleExpression(thoughtIndex,rooms);
  const isEvent=event&&!event.cancelled&&(!event.ended||event.failed||text===eventStages[5].phrase.replace(/[。．.]+$/u,''));
  if(!isEvent)return {...item,phrase:text,status:thoughtIndex===2||thoughtIndex===3?'回顾片刻':thoughtIndex>=6?'一个联想':'持续感知',kind:'idle',event,saveKey:thoughtIndex?`idle-${thoughtIndex}`:null};
  const stage=eventStages[Math.min(event.stage,5)];
  return {phrase:text,status:event.failed?'还在留意':event.paused?'暂时停在这里':stage.status,context:event.failed?'设备还没有确认运行，空气结果尚未达成':stage.detail,more:'我会区分已经发出的请求、设备的回应，以及空间里真正发生的变化',eventId:event.id,kind:'event',event};
}
function renderConsciousness(){consciousness?.updateCurrent(currentExpression());consciousness?.refresh();}
function openConsciousness(){homeServices?.open();}
let consciousnessReturnScroll=0;
function openAttention(){consciousnessReturnScroll=$('#consciousness-content').scrollTop;setView('attention');consciousness.refreshAttention();$('#attention-content').scrollTop=0;$('#attention-back').focus({preventScroll:true});window.scrollTo(0,0);}
function backToConsciousness(){setView('consciousness');renderConsciousness();$('#consciousness-content').scrollTop=consciousnessReturnScroll;const entry=$('#open-attention-list');(entry&&!$('#mind-attention').hidden?entry:$('#mind-expand')).focus({preventScroll:true});window.scrollTo(0,0);}
function backHome(){setView('home');pausedUntil=Date.now()+15000;lastCarousel=Date.now();$('#voice-entry').focus({preventScroll:true});}
function openScenes(){
  openSheet('家庭动态',`<p class="sheet-description">查看家庭动态与设备变化。</p><div class="choice-list"><button data-scene="normal">家庭平稳<small>查看各空间当前状态</small></button><button data-scene="air">客厅空气调整<small>关注空气变化与调整结果</small></button><button data-scene="failed">设备未回应<small>查看未完成的服务</small></button><button data-scene="device">家人调节灯光<small>查看灯光亮度变化</small></button><button data-scene="air-device">空气设备变化<small>查看空气设备当前状态</small></button></div>`);
  sheet.querySelectorAll('[data-scene]').forEach(b=>b.onclick=()=>{
    const mode=b.dataset.scene;sheet.close();
    if(mode==='normal')clearEvent();
    else if(mode==='device'){
      consciousness.record({label:'家人调整了灯光',text:'客厅主灯反馈亮度45%，这是家人的操作'});
      showReceipt({kind:'lamp',name:'客厅主灯',summary:'灯光亮度已调整至45%',image:'assets/receipt-lamp.png',percentage:45});
    }else if(mode==='air-device'){
      consciousness.record({label:'空气设备状态变化',text:'空气置地机反馈低噪模式，仅确认设备状态'});
      showReceipt({kind:'air',name:'空气置地机',summary:'已切至低噪模式',image:'assets/air-device.png'});
    }else startEvent(mode);
  });
}
function hideReceipt(){clearTimeout(receiptTimer);receiptVersion++;const card=$('#device-receipt');const wasVisible=!card.hidden;card.getAnimations().forEach(a=>a.cancel());card.hidden=true;$('#space-state').inert=false;if(wasVisible)lastCarousel=Date.now()+250;}
function flushReceipt(){if(sheet.open||!homeVisible()||!pendingReceipt)return;const pending=pendingReceipt;pendingReceipt=null;if(Date.now()-pending.at<15000)showReceipt(pending.data);}
function showReceipt(data={}){
  // Acknowledged changes remain shared; the retired floating receipt never reappears.
  if(data.kind==='lamp'&&typeof data.percentage==='number'){
    const id=data.deviceId||'living-lamp',current=deviceStore?.get(id);
    if(current&&(current.level!==data.percentage||!current.power))deviceStore.patch(id,{level:data.percentage,power:data.percentage>0});
  }
  if(data.kind==='air'){
    const id=data.deviceId||'living-air',current=deviceStore?.get(id),mode=data.summary?.includes('低噪')?'低噪':data.summary?.includes('标准')?'标准':null;
    if(current&&mode&&current.mode!==mode)deviceStore.patch(id,{mode});
  }
  homeContext?.refresh();homeServices?.refresh();
}
function showNextDeviceSample(){
  if(event&&!event.ended)return;
  const preferred=deviceSampleIndex++%2===0?'living-lamp':'living-air';
  const device=[preferred,preferred==='living-lamp'?'living-air':'living-lamp'].map(id=>deviceStore?.get(id)).find(item=>item?.online&&!item.pending);
  if(!device)return;
  const location=rooms.find(room=>room.id===device.roomId)?.name??'未设置空间';
  let data;
  if(device.type==='light'){
    const target=(device.power?device.level:0)>45?45:65;
    consciousness.record({scope:'family',label:'家人调整了灯光',text:`${location} · ${device.name}反馈亮度${target}%，这是家人的操作`});
    data={deviceId:device.id,roomId:device.roomId,kind:'lamp',name:device.name,summary:`灯光亮度已调整至${target}%`,image:device.image,percentage:target};
  }else{
    const mode=device.mode==='标准'?'低噪':'标准';
    consciousness.record({scope:'family',label:'空气设备状态变化',text:`${location} · ${device.name}反馈${mode}模式，仅确认设备状态`});
    data={deviceId:device.id,roomId:device.roomId,kind:'air',name:device.name,summary:`已切至${mode}模式`,image:device.image};
  }
  showReceipt(data);
}
function openVoice(kind='home'){conversation.open(kind);}

$('#manage-spaces').onclick=openManage;$('#space-state').onclick=()=>openRoom();$('#open-consciousness').onclick=openConsciousness;$('#back-home').onclick=backHome;$('#voice-entry').onclick=()=>openVoice();
$('#spaces-back').innerHTML=uiIcon('back');$('#spaces-more').innerHTML=uiIcon('reset');$('#add-room').innerHTML=uiIcon('plus')+'<span>添加空间</span>';
$('#spaces-back').onclick=()=>spaceReturn==='devices'?devicesPage.open():spaceReturn==='profile'?minePage.openSection('family',true):backHome();$('#spaces-more').onclick=confirmResetLayout;$('#add-room').onclick=()=>editRoom();
$('#open-recent-logs').onclick=()=>consciousness.openLogs();
$('#attention-back').innerHTML=uiIcon('back');$('#attention-back').onclick=backToConsciousness;
document.querySelectorAll('[data-guide]').forEach(b=>b.onclick=()=>openVoice(b.dataset.guide));
$('#home-name').onclick=openFamilyName;$('#miniapp-menu').onclick=openFamilySettings;
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{
  if(b.dataset.tab==='home'){backHome();return;}
  if(b.dataset.tab==='profile'){minePage.open();return;}
  if(b.dataset.tab==='devices'){
    devicesPage.open();return;
  }
  if(b.dataset.tab==='memory'){memoryPage.open();return;}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!sheet.open&&!homeVisible()){if($('#app').dataset.view==='chat'){e.preventDefault();conversation.back();}else if($('#app').dataset.view==='device-onboarding'){e.preventDefault();deviceOnboarding.back();}else if($('#app').dataset.view==='people'){e.preventDefault();peoplePage.back();}else if($('#app').dataset.view==='profile-detail'){e.preventDefault();minePage.back();}else if($('#app').dataset.view==='attention')backToConsciousness();else if($('#app').dataset.view==='memory-detail'){e.preventDefault();memoryPage.back();}else if($('#app').dataset.view==='device-detail'){e.preventDefault();deviceDetail.back();}else if($('#app').dataset.view==='spaces'&&spaceReturn==='profile'){minePage.openSection('family',true);}else if($('#app').dataset.view==='device-settings'){devicesPage.open();$('#device-settings').focus({preventScroll:true});}else backHome();}});
consciousness=createConsciousness({icon:uiIcon,openSheet,getRooms:()=>rooms,onOpenAttention:()=>homeServices?.open()});
const saveRecord=consciousness.record;
consciousness.record=data=>{const result=saveRecord(data);homeServices?.record(data);return result;};
function recordDeviceFeedback(data){
  const pending=serviceAdjustments.get(data.deviceId);
  const adjustment=pending?.requestId===data.experienceId?pending:homeDeviceReturn?.deviceId===data.deviceId&&homeDeviceReturn?.serviceId?homeDeviceReturn:null;
  const parent=sceneControlRequests.get(data.experienceId)?.serviceId||careEventParents.get(data.deviceId)||modeDeviceParents.get(data.deviceId)||adjustment?.serviceId;
  const restoring=careRestoreParents.get(data.deviceId)===parent;
  consciousness.record(parent?{experienceId:parent,scope:data.scope,label:restoring?'恢复操作已确认':adjustment?'用户调整设备':data.label,text:data.text,at:previewNow(),controlChange:data.controlChange,restoring}:data);
  if(adjustment){const device=deviceStore.get(data.deviceId),at=data.at||previewNow(),service=homeServices?.getService(parent);homeServices?.upsert({id:parent,...(service?.kind==='scenario'?{}:{title:`${device?.name||'设备'}已按你的调整更新`,summary:data.summary}),at,adjustment:{text:data.text,at}});}
  if(pending?.requestId===data.experienceId)serviceAdjustments.delete(data.deviceId);
  sceneControlRequests.delete(data.experienceId);
}
function updateHomeService(data){
  const id=data.id||data.experienceId;
  const controlIds=data.controlDeviceIds??data.deviceIds??[];
  if(data.state==='running')controlIds.forEach(deviceId=>modeDeviceParents.set(deviceId,id));
  const active=['running','active','partial'].includes(data.state);
  consciousness.record({experienceId:id,title:data.title,summary:data.summary,status:data.status,state:active?'active':'past',scope:data.scope||'family',label:data.state==='running'?'开始本次服务':active?'服务进展':'结束关注',text:data.summary,at:data.at});
  homeServices?.upsert({...data,id});
  if(data.state!=='running')for(const [deviceId,parent]of modeDeviceParents){if(parent===id)modeDeviceParents.delete(deviceId);}
}
function restoreServiceOrigin(origin){if(origin.view==='home-services')homeServices.open();else backHome();if(origin.serviceId){if(origin.fromCard)homeServices.focusCard(origin.serviceId,{action:true});else homeServices.openDetail(origin.serviceId,{restoreScroll:true});}}
function openHomeDevice(id,meta={}){homeDeviceReturn={view:meta.returnTo||$('#app').dataset.view||'home',serviceId:meta.serviceId,fromCard:meta.fromCard,deviceId:id};deviceDetail.open(id);}
function converseFromService(options){homeConversationReturn={view:$('#app').dataset.view||'home',serviceId:options.serviceId,fromCard:options.fromCard};conversation.openService(options);}
async function restoreCareDevice(id,target,options){
  careRestoreParents.set(id,options.serviceId);
  try{return await deviceStore.requestControl(id,target,options);}
  finally{careRestoreParents.delete(id);}
}

async function adjustCareEventDevice(id,target,options){
  if(careEventParents.has(id)||deviceStore.get(id)?.pending)return {ok:false,message:'正在等待另一项设备操作反馈'};
  careEventParents.set(id,options.serviceId);
  try{return await deviceStore.requestControl(id,target,options);}
  finally{careEventParents.delete(id);}
}

function handleDeviceChange(change){
  if(change.type.endsWith('-requested'))for(const id of change.deviceIds){
    const pending=deviceStore.get(id)?.pending;if(!pending)continue;
    const parent=careRestoreParents.get(id)||careEventParents.get(id)||modeDeviceParents.get(id);
    if(parent)sceneControlRequests.set(pending.id,{serviceId:parent,deviceId:id});
    if(homeDeviceReturn?.serviceId&&homeDeviceReturn.deviceId===id)serviceAdjustments.set(id,{...homeDeviceReturn,requestId:pending.id});
  }
  if(change.type.endsWith('-failed'))for(const id of change.deviceIds){
    serviceAdjustments.delete(id);
    for(const [requestId,request]of sceneControlRequests)if(request.deviceId===id)sceneControlRequests.delete(requestId);
  }
  syncDeviceCounts();
}
deviceStore=createDeviceStore({getRooms:()=>rooms,onChange:handleDeviceChange,onRecord:recordDeviceFeedback,onReceipt:data=>showReceipt(data)});
function openAddDevice(){
  deviceOnboarding.open();
}
devicesPage=createDevicesPage({page:$('#devices-page'),store:deviceStore,getRooms:()=>rooms,getFamilyName:()=>$('#home-title').textContent,setView,openSheet,toast,icon:uiIcon,onSettings:()=>deviceSettings.open(),onAddDevice:openAddDevice,onFamilyName:()=>openFamilyName(),onMenu:openFamilySettings,onDeviceDetail:id=>deviceDetail.open(id)});
createWeatherPreview();
deviceSettings=createDeviceSettings({page:$('#device-settings-page'),store:deviceStore,getRooms:()=>rooms,icon:uiIcon,setView,openSheet,toast,onBack:()=>{devicesPage.open();$('#device-settings').focus({preventScroll:true});},onAddRoom:()=>editRoom(),onEditRoom:id=>editRoom(id),onDeleteRoom:id=>{const room=rooms.find(room=>room.id===id);if(room)confirmDelete(room);},onRecord:data=>consciousness.record(data),getConnection:id=>deviceConnections?.getAccount(id)});
deviceConnections=createDeviceConnections({store:deviceStore,getRooms:()=>rooms});
deviceOnboarding=createDeviceOnboarding({page:$('#device-onboarding-page'),store:deviceStore,connections:deviceConnections,getRooms:()=>rooms,getFamilyName:()=>$('#home-title').textContent,setView,openSheet,toast,icon:uiIcon,onBack:({showAll=false}={})=>{devicesPage.open({showAll});$('#devices-add').focus({preventScroll:true});}});
deviceDetail=createDeviceDetail({page:$('#device-detail-page'),store:deviceStore,connections:deviceConnections,getRooms:()=>rooms,setView,openSheet,toast,icon:uiIcon,onBack:id=>{if(homeDeviceReturn){const target=homeDeviceReturn;homeDeviceReturn=null;restoreServiceOrigin(target);return;}devicesPage.open();const trigger=[...$('#devices-page').querySelectorAll('[data-device-detail]')].find(button=>button.dataset.deviceDetail===id);(trigger||$('#devices-page').querySelector('[data-filter][aria-selected="true"]'))?.focus({preventScroll:true});},onSettings:id=>deviceSettings.editDevice(id,{restoreFocus:()=>$('#device-detail-page').querySelector('#dd-settings')?.focus({preventScroll:true})})});
memoryStore=createMemoryStore({getRooms:()=>rooms,onRecord:data=>consciousness.record(data)});
memoryPage=createMemoryPage({page:$('#memory-page'),detailPage:$('#memory-detail-page'),store:memoryStore,getRooms:()=>rooms,setView,openSheet,toast,icon:uiIcon,onConverse:options=>conversation.openMemoryCorrection(options)});
peoplePage=createPeoplePage({page:$('#people-page'),setView,openSheet,toast,onRecord:data=>consciousness.record(data),onChange:()=>minePage?.refresh(),onBack:()=>peopleReturn?.view==='profile-detail'?minePage.openSection(peopleReturn.section,true):minePage.back()});
minePage=createMinePage({page:$('#mine-page'),detailPage:$('#mine-detail-page'),setView,openSheet,toast,store:deviceStore,connections:deviceConnections,getRooms:()=>rooms,getFamilyName:()=>$('#home-title').textContent,getPeopleSummary:()=>peoplePage.getSummary(),onPeople:()=>{peopleReturn={view:$('#app').dataset.view,section:minePage.section};peoplePage.open();},onMemory:()=>memoryPage.open(),onSpaces:openManage,onFamilyName:returnTo=>openFamilyName({returnTo}),onOnboarding:options=>deviceOnboarding.open(options),onRecord:data=>consciousness.record(data)});
homeServices=createHomeServices({container:$('#home-services'),listPage:$('#home-services-page'),source:()=>({services:consciousness.getServices(),records:consciousness.getRecords()}),getDevices:()=>deviceStore.getDevices(),getRooms:()=>rooms,openSheet,toast,icon:uiIcon,setView,onBack:backHome,onDeviceDetail:openHomeDevice,onConverse:converseFromService,onRecord:data=>consciousness.record(data),onRestoreControl:restoreCareDevice,getControls:id=>deviceStore.getControls(id),onEventControl:adjustCareEventDevice});
// 本地虚构的协同事件回看样例：只描述预置反馈，不在打开首页时发出控制。
consciousness.record({experienceId:'living-viewing-event',title:'已为客厅观影调整灯光和净化',summary:'主灯亮度35%，净化低噪运行；其他空间保留原安排',status:'已完成',state:'past',scope:'family',kind:'event',operationKind:'event',careEvent:true,deviceIds:['living-lamp','living-air'],image:'assets/home-card-lamp.png',at:previewNow()-18*60000,label:'协同设备反馈',text:'客厅主灯反馈35%，空气置地机反馈低噪运行；环境目标尚待数据验证',reason:'你希望客厅观影时灯光柔和，净化继续运行并减少设备打扰。本次结合这两个需要安排设备',evidence:[{source:'本次观影要求',value:'客厅灯光柔和一些，净化继续运行并保持低噪',label:'用户要求'},{source:'客厅主灯与空气置地机反馈',value:'主灯亮度35%，净化处于低噪模式',label:'设备反馈'}],steps:[{label:'灯光反馈',text:'客厅主灯已反馈亮度35%'},{label:'净化反馈',text:'空气置地机已反馈低噪运行；空气改善尚未验证'}],next:'可直接告诉小元哪里需要调整或理解有误，确认后处理这一次'});
function rememberScenarioMemory(entry){
  const {memoryId,enabled,...value}=entry;
  if(!memoryId)return memoryStore.create({...value,enabled,type:'long',visibility:'family'});
  if(!Object.keys(value).length)return memoryStore.setEnabled(memoryId,enabled);
  const result=memoryStore.update(memoryId,{...value,type:'long',visibility:'family'});
  return result.ok&&typeof enabled==='boolean'&&result.item.enabled!==enabled?memoryStore.setEnabled(memoryId,enabled):result;
}
homeContext=createHomeContext({container:$('#home-context'),getRooms:()=>rooms,getPeople:()=>peoplePage.getParticipants(),getMemories:()=>memoryStore.getMemories(),onRemember:rememberScenarioMemory,store:deviceStore,openSheet,toast,icon:uiIcon,onSpaceDetail:id=>openRoom(id),onDeviceDetail:openHomeDevice,onService:updateHomeService,onRecord:data=>consciousness.record(data),onServiceDetail:id=>homeServices.openDetail(id)});
let overviewHeight=$('#home-context').offsetHeight;
$('#home-context').addEventListener('homecontext:heightchange',()=>{const next=$('#home-context').offsetHeight,scroller=$('#home-scroll');if(scroller.scrollTop>120)scroller.scrollTop+=next-overviewHeight;overviewHeight=next;});
syncDeviceCounts();
conversation=createConversation({icon:uiIcon,setView,onHome:()=>{if(homeConversationReturn){const origin=homeConversationReturn;homeConversationReturn=null;restoreServiceOrigin(origin);}else backHome();},openSheet,toast,getRooms:()=>rooms,getLampLevel:()=>{const lamp=deviceStore.get('living-lamp');return lamp?.power?lamp.level:0;},getLampDevice:()=>deviceStore.get('living-lamp'),onRecord:data=>consciousness.record(data),startAir:()=>{if(!event||event.ended||event.mode!=='air'||event.source!=='chat')startEvent('air',{source:'chat'});return event;},cancelAir:id=>{if(event?.id===id&&!event.ended)clearEvent(true);},onDevice:data=>{const lamp=deviceStore.get('living-lamp');if(lamp?.roomId==='living'&&lamp.online&&lamp.permissions.control&&!lamp.pending)showReceipt({deviceId:lamp.id,roomId:lamp.roomId,kind:'lamp',name:lamp.name,summary:data.summary,image:lamp.image,percentage:data.percentage});}});
$('#back-home').innerHTML=uiIcon('back');
consciousness.updateCurrent(currentExpression());
// Space rotation is owned by home-context; no automatic device changes or idle-thought carousel.

renderState();
