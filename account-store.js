// Local review model. No WeChat, box discovery or biometric verification is performed.
export const ACCOUNT_BUILD='simple-invites-20261113';
export const JOIN_INVITE='invite-new', CLAIM_INVITE='invite-mom';
export const FAMILY_ROLES=['爸爸','妈妈','爷爷','奶奶','外公','外婆','儿子','女儿'];
const clone=value=>structuredClone(value);
const key=value=>String(value??'').normalize('NFKC').trim().toLocaleLowerCase('zh-CN');
const sample=()=>[{id:'voice-mom',url:'assets/voice-enrollment-sample.wav',duration:5.88,preset:true}];
export function seedAccountCase(scenario='visitor'){
  if(['pending','claim-rejected'].includes(scenario))scenario='invite';
  const accounts={admin:{id:'wx-admin',name:'小雨'},receiver:{id:'wx-receiver',name:'小沐'},mom:{id:'wx-mom',name:'林女士'},dad:{id:'wx-dad',name:'老林'},guest:{id:'wx-guest',name:'小禾'}};
  const person=(id,name,role,accountId=null,extra={})=>({id,name,role,birthday:'',accountId,permission:'member',photo:'',samples:[],enabled:true,...extra});
  const existing=['admin','member','invite','claim','invite-expired','invite-cancelled'].includes(scenario);
  const local=scenario==='local-box';
  const members=existing?[person('person-yu','小雨','女儿','wx-admin',{permission:'admin'}),person('person-mom','妈妈','妈妈',null,{birthday:'1965-05-18',photo:'assets/person-mom-photo.png',samples:sample()}),person('person-dad','爸爸','爸爸','wx-dad')]:local?[person('person-mom','妈妈','妈妈',null,{photo:'assets/person-mom-photo.png',samples:sample()})]:[];
  const invitations=existing?[{id:JOIN_INVITE,kind:'new',targetId:null,status:'valid',expiresAt:Date.now()+86400000},{id:CLAIM_INVITE,kind:'claim',targetId:'person-mom',status:scenario==='invite-expired'?'expired':scenario==='invite-cancelled'?'cancelled':'valid',expiresAt:Date.now()+(scenario==='invite-expired'?-1000:86400000)}]:[];
  return {version:3,scenario,accounts,actor:['admin'].includes(scenario)?'admin':scenario==='member'?'dad':['claim','invite-expired','invite-cancelled'].includes(scenario)?'mom':'receiver',loggedIn:['signed','admin','member'].includes(scenario),familyName:existing?'潘多拉的家':'我的家',familyFresh:!existing&&!local,localUsed:local,activated:existing,setupComplete:existing,members,invitations,next:10};
}
export function createAccountStore({scenario='visitor',initial=null,persist=()=>{}}={}){
  const s=initial?clone(initial):seedAccountCase(scenario),listeners=new Set();
  delete s.requests;
  if(['pending','claim-rejected'].includes(s.scenario))s.scenario='invite';
  const actor=()=>s.accounts[s.actor];
  const self=()=>s.loggedIn?s.members.find(m=>m.accountId===actor().id):null;
  const admin=()=>self()?.permission==='admin';
  function emit(){persist(clone(s));listeners.forEach(fn=>fn());}
  const fail=message=>({ok:false,message});
  function validate(draft,id=null){
    const name=String(draft.name??'').normalize('NFKC').trim(),role=String(draft.role??'').normalize('NFKC').trim(),birthday=String(draft.birthday??'');
    if(!name)return fail('请填写昵称');
    if([...name].length>20)return fail('昵称最多20个字');
    if([...role].length>12)return fail('家庭角色最多12个字');
    if(s.members.some(m=>m.id!==id&&key(m.name)===key(name)))return fail('该昵称已使用，请换一个');
    if(role&&s.members.some(m=>m.id!==id&&key(m.role)===key(role)))return fail('该角色已使用，请选择其他角色');
    if(birthday&&(!/^\d{4}-\d{2}-\d{2}$/.test(birthday)||Number.isNaN(Date.parse(birthday))||new Date(birthday).toISOString().slice(0,10)!==birthday||birthday>new Date().toLocaleDateString('sv-SE')))return fail('请选择有效的生日，不能晚于今天');
    return {ok:true,value:{name,role,birthday}};
  }
  function invitation(inviteId){
    const v=s.invitations.find(i=>i.id===inviteId);if(!v)return fail('邀请信息不正确，请重新获取邀请');
    if(v.status==='cancelled')return fail('这份邀请已取消，请重新获取邀请');
    if(v.status==='expired'||v.expiresAt<=Date.now())return fail('这份邀请已过期，请重新获取邀请');
    if(v.status==='used')return fail('这份邀请已使用，请重新获取邀请');
    if(v.kind==='claim'&&s.members.find(m=>m.id===v.targetId)?.accountId)return fail('该身份已被认领，不能重复认领');
    return {ok:true,invite:clone(v)};
  }
  function attach(member,accountId,invite){
    member.accountId=accountId;invite.status='used';
    for(const other of s.invitations)if(other.id!==invite.id&&other.targetId===member.id&&other.status==='valid')other.status='cancelled';
  }
  function editable(id){return admin()||self()?.id===id;}
  const api={
    snapshot:()=>clone(s),actor:()=>clone(actor()),current:()=>self()?clone(self()):null,isAdmin:admin,
    members:()=>clone(admin()?s.members:self()?[self()]:[]),
    participants:()=>s.members.map(({id,name,enabled})=>({id,name,enabled})),
    subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
    login(){s.loggedIn=true;emit();return {ok:true};},
    validate,
    roleTaken(value,id=null){return Boolean(value&&s.members.some(m=>m.id!==id&&key(m.role)===key(value)));},
    syncSharedReview(value){if(!admin()||value?.version!==3||value.members?.filter(m=>m.permission==='admin').length!==1||!value.members.some(m=>m.id===self().id&&m.accountId===actor().id&&m.permission==='admin'))return fail('无法同步该体验家庭');s.members=clone(value.members);s.invitations=clone(value.invitations);s.accounts=clone(value.accounts);s.next=value.next;s.familyName=value.familyName;emit();return {ok:true};},
    renameFamily(name){if(!admin())return fail('此项由管理员维护');name=String(name).trim();if(!name||[...name].length>20)return fail('家庭名称为1～20个字');s.familyName=name;emit();return {ok:true};},
    activate(){if(!s.loggedIn)return fail('请先登录');if(s.activated)return self()?{ok:true,member:clone(self())}:fail('盒子已被认领，请通过邀请加入');let m=s.members.find(p=>p.accountId===actor().id);if(!m){let name=actor().name;while(s.members.some(p=>key(p.name)===key(name)))name=actor().name+(++s.next);m={id:'member-'+(++s.next),name,role:'',birthday:'',accountId:actor().id,permission:'admin',photo:'',samples:[],enabled:true};s.members.push(m);}m.permission='admin';s.activated=true;s.setupComplete=false;emit();return {ok:true,member:clone(m)};},
    completeSetup(draft){if(!admin()||!s.activated)return fail('请先连接并激活盒子');if(s.setupComplete!==false)return {ok:true,member:clone(self())};const familyName=String(draft.familyName??'').normalize('NFKC').trim();if(!familyName)return fail('请填写家庭名称');if([...familyName].length>20)return fail('家庭名称最多20个字');const v=validate(draft,self().id);if(!v.ok)return v;Object.assign(self(),v.value);s.familyName=familyName;s.setupComplete=true;emit();return {ok:true,member:clone(self())};},
    add(draft,recognition={}){if(!admin())return fail('此项由管理员维护');const v=validate(draft);if(!v.ok)return v;const m={id:'member-'+(++s.next),...v.value,accountId:null,permission:'member',photo:recognition?.photo||'',samples:clone(recognition?.samples||[]),enabled:recognition?.enabled!==false};s.members.push(m);emit();return {ok:true,member:clone(m)};},
    update(id,draft){if(!editable(id))return fail('你只能查看和修改自己的身份');const m=s.members.find(p=>p.id===id);if(!m)return fail('成员已不存在');const v=validate({...m,...draft},id);if(!v.ok)return v;Object.assign(m,v.value);emit();return {ok:true,member:clone(m)};},
    updateRecognition(id,profile){if(!editable(id))return fail('你只能维护自己的识别资料');const m=s.members.find(p=>p.id===id);if(!m)return fail('成员已不存在');Object.assign(m,{photo:profile.photo||'',samples:clone(profile.samples||[]),enabled:profile.enabled!==false});emit();return {ok:true};},
    remove(id){if(!admin())return fail('此项由管理员维护');const m=s.members.find(p=>p.id===id);if(!m)return fail('成员已不存在');if(m.permission==='admin')return fail('不能移除唯一管理员');s.members=s.members.filter(p=>p.id!==id);for(const i of s.invitations)if(i.targetId===id)i.status='cancelled';emit();return {ok:true};},
    createInvite(targetId=null){if(!admin())return fail('此项由管理员维护');const target=s.members.find(m=>m.id===targetId);if(targetId&&(!target||target.accountId))return fail('该身份不存在或已被认领');let v=s.invitations.find(i=>i.kind===(targetId?'claim':'new')&&i.targetId===targetId&&i.status==='valid'&&i.expiresAt>Date.now());if(!v){v={id:'invite-'+(++s.next),kind:targetId?'claim':'new',targetId,status:'valid',expiresAt:Date.now()+86400000};s.invitations.push(v);}emit();return {ok:true,invite:clone(v)};},
    cancelInvite(id){if(!admin())return fail('此项由管理员维护');const i=s.invitations.find(v=>v.id===id);if(i&&i.status==='valid')i.status='cancelled';emit();return {ok:true};},
    invitation,
    inviteTarget(inviteId){
      const raw=s.invitations.find(i=>i.id===inviteId),me=self();
      if(me&&raw&&(raw.kind==='new'||raw.targetId===me.id))return {ok:true,invite:clone(raw),target:raw.targetId?{id:me.id,name:me.name,role:me.role}:null,familyName:s.familyName,alreadyJoined:true};
      const v=invitation(inviteId);if(!v.ok)return v;const p=s.members.find(m=>m.id===v.invite.targetId);
      return {...v,target:p?{id:p.id,name:p.name,role:p.role}:null,familyName:s.familyName};
    },
    join(inviteId,draft){
      if(!s.loggedIn)return fail('请先登录');if(self())return {ok:true,existing:true,member:clone(self())};
      const v=invitation(inviteId);if(!v.ok)return v;if(v.invite.kind!=='new')return fail('请确认指定身份');
      const check=validate(draft);if(!check.ok)return check;
      const m={id:'member-'+(++s.next),...check.value,accountId:actor().id,permission:'member',photo:'',samples:[],enabled:true};s.members.push(m);
      const i=s.invitations.find(i=>i.id===v.invite.id);i.status='used';emit();return {ok:true,member:clone(m)};
    },
    acceptClaim(inviteId){
      if(!s.loggedIn)return fail('请先登录');const raw=s.invitations.find(i=>i.id===inviteId),me=self();
      if(me)return raw?.targetId===me.id?{ok:true,existing:true,member:clone(me)}:fail('当前账号已认领其他身份，不能覆盖');
      const v=invitation(inviteId);if(!v.ok)return v;if(v.invite.kind!=='claim')return fail('此链接仅用于创建新身份，请使用管理员发送的指定认领链接');
      const m=s.members.find(m=>m.id===v.invite.targetId);if(!m||m.accountId)return fail('该身份已不存在或已被认领');
      attach(m,actor().id,s.invitations.find(i=>i.id===v.invite.id));emit();return {ok:true,member:clone(m)};
    },
    // Explicit review controls; not a product account switch or real login.
    switchActor(value){if(!s.accounts[value])return fail('没有这个体验账号');s.actor=value;s.loggedIn=true;emit();return {ok:true};},
  };
  return api;
}
export function loadAccountSession(token){try{const value=JSON.parse(sessionStorage.getItem('origin-account:'+token));return value?.version===3?value:null;}catch{return null;}}
export function saveAccountSession(token,value){try{sessionStorage.setItem('origin-account:'+token,JSON.stringify(value));return true;}catch{return false;}}
