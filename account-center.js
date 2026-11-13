import {esc,arrow,backIcon,memberForm,readMemberForm,memberFormError,bindRoleForm,installAccountKeyboard,memberRow,facts} from './account-ui.js?v=simple-invites-20261113';
export function createAccountCenter({store,page,detailPage,setView,openSheet,toast,legacy,getRooms=()=>[],getDevices=()=>[],onMountRecognition,onClearRecognition=()=>{},onFamilyName,onSpaces,onEnter}){
 const app=page.closest('.app'),sheet=app.querySelector('#sheet');
 let section='',selected=null,invitation=null,inviteReturn=null,dirty=false,baseFields=null,draftProfile=null,draftRecognition=null;
 const current=()=>store.current();
 const row=(action,title,note='')=>`<button class="mp-menu-row" data-ac="${action}"><span><strong>${title}</strong><small>${esc(note)}</small></span>${arrow}</button>`;
 const group=items=>`<div class="mp-menu-group">${items.map(([a,t,n],i)=>row(a,t,n).replace('<span><strong>',`${i?'<span class="mp-ref-divider" aria-hidden="true"><img src="assets/mine-row-divider.svg" alt=""></span>':''}<span><strong>`)).join('')}</div>`;
 function main(){
  const me=current();if(!me)return;
  const familyCard=store.isAdmin()?`<section class="mp-family-card" aria-label="当前家庭"><button class="mp-family-main" data-ac="family"><strong>${esc(store.snapshot().familyName)}</strong><small>${store.members().length}位成员 · ${getRooms().length}个空间 · ${getDevices().length}台设备</small></button>${store.isAdmin()?'<div class="mp-family-actions"><button data-ac="members" aria-label="查看家庭成员"><span class="mp-member-asset"><img src="assets/mine-member.svg" alt=""></span></button><button data-ac="invite" aria-label="邀请加入家庭"><span class="mp-invite-asset"><img src="assets/mine-invite.svg" alt=""></span></button></div>':''}</section>`: "";
  page.innerHTML=`<header class="mp-header"><h1>个人中心</h1><div class="mp-header-decoration" aria-hidden="true"><img class="mp-header-art" src="assets/mine-header-art.png" alt=""><span class="mp-header-overlay"><img src="assets/mine-header-overlay.svg" alt=""></span></div><button class="mp-profile" data-ac="self"><img class="mp-profile-avatar" src="assets/mine-avatar.png" alt="个人头像"><span class="mp-profile-copy"><strong>${esc(me.name)}</strong><small class="ac-profile-role">${store.isAdmin()?'管理员':'普通成员'}</small></span></button></header><main class="mp-scroll">${familyCard}${group([[store.isAdmin()?'members':'self',store.isAdmin()?'家庭成员':'我的身份',store.isAdmin()?'成员资料与身份认领':'基本信息、人脸与声纹'],['scenes','场景包','康养场景包已安装']])}${group([...(store.isAdmin()?[['connections','接入管理','管理设备来源与账号授权']]:[]),['hardware','盒子与电视','查看家庭中枢与大屏连接']])}${group([['preferences','服务与通知','提醒方式与小元的服务偏好'],['privacy','隐私与数据','隐私政策与数据相关协议'],['help','帮助与关于','连接、使用与常见问题']])}</main>`;
 }
 function shell(title,body,footer=''){
  onClearRecognition();detailPage.dataset.section='accounts';
  detailPage.innerHTML=`<header class="mp-detail-header"><button class="icon-button" data-ac="back" aria-label="返回">${backIcon}</button><h1>${esc(title)}</h1><span></span></header><main class="mp-detail-scroll ac-scroll">${body}</main>${footer?`<footer class="mp-detail-actions ac-footer">${footer}</footer>`:''}<div class="mp-home-indicator" aria-hidden="true"></div>`;
 }
 function accountName(m){
  if(!m.accountId)return '暂未绑定微信';
  const a=Object.values(store.snapshot().accounts).find(a=>a.id===m.accountId);
  return a?`${a.name}${m.id===current()?.id?'（你）':''}`:'已绑定微信';
 }
 function trackForm(){
  bindRoleForm(detailPage,'ac',{store,memberId:selected});
  const update=()=>{dirty=JSON.stringify(readMemberForm(detailPage))!==JSON.stringify(baseFields)||(section==='add'&&Boolean(draftProfile?.photo||draftProfile?.samples.length||draftProfile?.enabled===false));if(section==='add')draftRecognition?.setName(readMemberForm(detailPage).name.trim()||'新成员');const save=detailPage.querySelector('[data-ac=save]');if(save)save.disabled=section!=='add'&&!dirty;detailPage.querySelector('#ac-error').textContent='';};
  detailPage.querySelector('.ac-form').addEventListener('input',update);detailPage.querySelector('.ac-form').addEventListener('change',update);
 }
 function memberDetail(id){
  const m=store.members().find(p=>p.id===id);if(!m){toast('你只能查看自己的身份');open();return;}
  selected=id;section='member';dirty=false;baseFields={name:m.name,role:m.role,birthday:m.birthday};
  const own=m.id===current()?.id;
  shell(own?'我的身份':'成员资料',`<div class="ac-member-heading"><span>${m.permission==='admin'?'管理员':'普通成员'}</span>${!m.accountId?'<small>暂未认领身份，也可在家使用小元</small>':''}</div>${memberForm(m,store,{note:false,accountLabel:accountName(m)})}<div id="ac-recognition" class="ac-recognition" aria-label="人脸与声纹"></div>${store.isAdmin()&&!own?`<button class="ac-danger" data-ac="remove">${m.accountId?'移出家庭':'删除成员'}</button>`:''}`,`${store.isAdmin()&&!own&&!m.accountId?'<button class="secondary-button" data-ac="claim-invite">邀请本人认领</button>':''}<button class="primary-button" data-ac="save" disabled>保存</button>`);
  trackForm();onMountRecognition(m,detailPage.querySelector('#ac-recognition'));
 }
 function add(){
  selected=null;section='add';dirty=false;baseFields={name:'',role:'',birthday:''};draftProfile={photo:'',samples:[],enabled:true};
  shell('添加成员',`<p class="mp-section-caption">昵称必填，其他资料可选填。</p>${memberForm({},store,{note:false,accountLabel:'暂未绑定微信'})}<div id="ac-recognition" class="ac-recognition" aria-label="人脸与声纹"></div>`,`<button class="primary-button" data-ac="save">添加成员</button>`);
  draftRecognition=onMountRecognition({id:'new-member-draft',name:'新成员',...draftProfile},detailPage.querySelector('#ac-recognition'),{draft:true,onChange:profile=>{draftProfile={photo:profile.photo,samples:profile.samples,enabled:profile.enabled};dirty=JSON.stringify(readMemberForm(detailPage))!==JSON.stringify(baseFields)||Boolean(profile.photo||profile.samples.length||profile.enabled===false);}});trackForm();
 }
 function members(){
  if(!store.isAdmin()){memberDetail(current().id);return;}
  section='members';dirty=false;
  shell('家庭成员',`<div class="mp-list ac-members">${store.members().map(m=>memberRow(m,current().id)).join('')}</div><p class="ac-note">没有认领身份的家人，也可以使用小元并保存自己的记忆。</p>`,'<button class="secondary-button" data-ac="add">添加成员</button><button class="primary-button" data-ac="invite">邀请加入</button>');
 }
 function family(){
  section='family';dirty=false;
  const name=store.snapshot().familyName;
  shell('当前家庭',`<div class="mp-section-intro mp-family-intro"><span class="mp-house-art"><img src="assets/mine-family-house.png" alt=""></span><h2>${esc(name)}</h2><p>${getRooms().length} 个空间${store.isAdmin()?' · '+store.members().length+' 位成员':''}</p></div>${store.isAdmin()?`<div class="mp-list">${row('family-name','家庭名称',name)}${row('spaces','空间管理',getRooms().length+'个空间')}${row('members','家庭成员','管理身份资料与识别')}</div>`:facts([['你的身份',current().name],['成员权限','普通成员']])}<p class="ac-note">${store.isAdmin()?'你是首次连接并激活盒子的管理员，可维护家庭、接入与成员资料。':'家庭空间状态、日常设备与场景共享；成员资料和个人记忆仅自己可见。'}</p>`);
 }
 function showInvite(targetId=null){
  const result=store.createInvite(targetId);if(!result.ok){toast(result.message);return;}
  inviteReturn=section==='member'?selected:null;invitation=result.invite;section='invitation';dirty=false;
  const target=targetId?store.members().find(m=>m.id===targetId):null;
  const link=new URL('first-use.html',location.href);link.search='';link.searchParams.set('case',target?'claim':'invite');link.searchParams.set('voice-preview','1');link.searchParams.set('invite',invitation.id);link.searchParams.set('account-session',store.sessionToken||new URLSearchParams(location.search).get('account-session')||'');link.searchParams.set('recipient','1');invitation.link=link.href;
  const until=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(invitation.expiresAt);
  shell(target?'邀请本人认领':'邀请加入家庭',`<div class="mp-section-intro mp-family-intro"><span class="mp-house-art"><img src="assets/mine-family-house.png" alt=""></span><h2>${esc(store.snapshot().familyName)}</h2><p>${target?'将邀请链接发给这位成员本人':'将链接发给家人，填写自己的身份信息即可加入'}</p></div>${target?facts([['认领身份',target.name],['家庭角色',target.role||'暂无']]):''}<div class="ac-invite-link"><strong>邀请链接已生成</strong><span>${until}前有效 · 接受后失效</span></div><p class="ac-note">${target?'对方点击链接并确认，即可认领此身份，延续原有资料和个人记忆。':'对方点击链接，填写昵称即可创建新身份并加入。空间状态、日常设备和场景共享，个人内容各自独立。'}</p><button class="ac-danger" data-ac="cancel-invite">取消这份邀请</button><button class="ac-demo-trigger" data-ac="preview-recipient">预览接收方流程</button>`,`<button class="primary-button" data-ac="copy-invite" data-invite-link="${esc(invitation.link)}">复制邀请链接</button>`);
 }
 function confirm(title,content,action){
  openSheet(title,`<p class="sheet-description">${content}</p><p class="form-error" id="ac-confirm-error" role="alert"></p><div class="dialog-actions"><button class="secondary-button" id="ac-confirm-cancel">取消</button><button class="primary-button" id="ac-confirm-ok">确认</button></div>`,{variant:'float'});
  sheet.querySelector('#ac-confirm-cancel').onclick=()=>sheet.close();sheet.querySelector('#ac-confirm-ok').onclick=()=>{const r=action();if(r?.ok===false){sheet.querySelector('#ac-confirm-error').textContent=r.message;return;}sheet.close();};
 }
 function help(){
  section='help';shell('帮助与关于',`<div class="mp-about"><img src="assets/consciousness.svg" alt="小元"><h2>引元 · 小元</h2><p>家庭与生活管家<br>个人与工作助手</p></div><div class="mp-faq">${[['没有认领身份的家人，也能使用小元吗？','可以。管理员添加成员并补充人脸或声纹后，小元可据可用来源认识家人、交流并保存记忆。'],['如何认领提前添加的身份？','管理员可从成员资料发出指定身份邀请，本人登录并确认认领后即可使用，原有资料与个人记忆会保留。'],['管理员可以查看所有个人记忆吗？','不能直接查看。家庭记忆共享，个人记忆和私人对话仅对应成员可见；已有身份只能通过管理员发出的指定身份链接认领。'],['如何修改小元对我的理解？','在记忆中打开对应内容直接修改，也可以告诉小元，确认后保存。']].map(([q,a])=>`<details><summary>${q}${arrow}</summary><p>${a}</p></details>`).join('')}</div>`);
 }
 function open(){section='';dirty=false;onClearRecognition();setView('profile');main();}
 function openSection(value){
  if(!current())return;
  if(['family','members','account','self'].includes(value)){setView('profile-detail');if(value==='family')family();else if(value==='account'||value==='self')memberDetail(current().id);else members();}
  else if(value==='help'){setView('profile-detail');help();}
  else{section='legacy';onClearRecognition();legacy.openSection(value);}
 }
 function back(){
  if(section==='member'){if(store.isAdmin()&&selected!==current().id)members();else open();}
  else if(section==='invitation'){if(inviteReturn)memberDetail(inviteReturn);else members();}
  else if(section==='add')members();else open();
 }
 function save(){
  const formError=memberFormError(detailPage);if(formError){detailPage.querySelector('#ac-error').textContent=formError;return;}
  const data=readMemberForm(detailPage),adding=section==='add',result=adding?store.add(data,draftProfile):store.update(selected,data);
  if(!result.ok){detailPage.querySelector('#ac-error').textContent=result.message;return;}
  if(adding){draftRecognition?.commitDraft(result.member);draftRecognition=null;draftProfile=null;}
  dirty=false;memberDetail(result.member.id);toast(adding?'成员已添加':'成员资料已保存');
 }
 function click(e){
  const member=e.target.closest('[data-ac-member]');if(member){memberDetail(member.dataset.acMember);return;}
  const action=e.target.closest('[data-ac]')?.dataset.ac;if(!action)return;
  if(action==='back'){if(dirty&&['member','add'].includes(section))confirm('放弃未保存的修改？',section==='add'?'本次成员资料尚未保存，已添加的照片和声纹也将丢弃。':'本次基本信息修改尚未保存。',()=>{dirty=false;back();});else back();return;}
  if(['family','members','self'].includes(action)){openSection(action);return;}
  if(action==='add'){add();return;}if(action==='save'){save();return;}
  if(action==='family-name'){onFamilyName();return;}if(action==='spaces'){onSpaces();return;}
  if(action==='invite'){showInvite();setView('profile-detail');return;}
  if(action==='claim-invite'){if(dirty){toast('请先保存基本信息，再发送邀请');return;}showInvite(selected);return;}
  if(action==='preview-recipient'){const state=store.snapshot();const actor=invitation.kind==='claim'?'mom':state.members.some(m=>m.accountId==='wx-receiver')?'guest':'receiver';onEnter({invite:invitation.id,actor});return;}
  if(action==='copy-invite'){navigator.clipboard.writeText(invitation.link).then(()=>toast('邀请链接已复制，发给对方后点击即可加入'),()=>toast('链接暂未复制成功，请重试'));return;}
  if(action==='cancel-invite'){confirm('取消这份邀请？','取消后邀请链接失效，已有成员不受影响。',()=>{const r=store.cancelInvite(invitation.id);if(r.ok){members();toast('邀请已取消');}return r;});return;}
  if(action==='remove'){const m=store.members().find(v=>v.id===selected);confirm(m.accountId?'移出家庭？':'删除成员？',`${esc(m.name)}将停止使用本家庭的成员身份和识别资料，原事件记录保留。此操作不将记忆转给其他成员。`,()=>{const r=store.remove(selected);if(r.ok){members();toast('成员已移除');}return r;});return;}
  if(['scenes','connections','hardware','preferences','privacy','help'].includes(action))openSection(action);
 }
 installAccountKeyboard(detailPage);
 page.addEventListener('click',click);detailPage.addEventListener('click',click);
 detailPage.addEventListener('click',e=>{if(section!=='legacy')return;const action=e.target.closest('[data-mp]')?.dataset.mp;if(action==='back'){e.stopImmediatePropagation();open();}else if(['family','account-home','account','people','nickname'].includes(action)){e.stopImmediatePropagation();openSection(['account','people','nickname'].includes(action)?'self':'family');}},{capture:true});
 return {open,openSection,back,refresh(){if(section===''&&app.dataset.view==='profile')main();else if(section==='invitation'&&invitation){const latest=store.snapshot().invitations.find(i=>i.id===invitation.id);if(latest?.status==='used'){shell('邀请已接受',`<div class="ac-empty"><h2>对方已加入家庭</h2><p>${invitation.kind==='claim'?'已认领原身份，资料与个人记忆已保留。':'邀请已使用，你可以在家庭成员中查看结果。'}</p></div>`,`<button class="primary-button" data-ac="back">返回成员资料</button>`);}}},onViewChange(next){legacy.onViewChange(next);},get section(){return section;}};
}
