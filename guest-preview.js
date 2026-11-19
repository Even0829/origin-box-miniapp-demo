import {seedAccountCase} from './account-store.js?v=simple-invites-20261113';
export const GUEST_BUILD='guest-preview-20261119';
export function createGuestSeed(){
 const state=seedAccountCase('admin');
 return {...state,scenario:'guest',actor:'receiver',loggedIn:false};
}
export function guestSpaceState(state){
 return {...state,people:state.people.map((person,index)=>({...person,id:'presence-'+index,name:'在场者'+(index+1),photo:'',methods:[]}))};
}
const publicServices=new Set(['living-viewing-event','care-air-observing','care-bedroom-pending','care-dining-connection','quiet-air','evening-light','kitchen-light','bedroom-soft-light']);
export function guestCareData(data){
 const services=data.services.filter(item=>item.scope!=='personal'&&(publicServices.has(item.id)||item.guestOperation||['device-control','device-feedback'].includes(item.kind)));
 return {services:services.map(item=>({...item,manage:null,correct:null,end:null,retry:null,converse:null,
  reason:'结合这次设备服务的反馈，接续已经发生的操作，并留意尚未确认的结果。',
  evidence:[{source:'设备服务进展',label:'本次服务',value:item.summary,at:item.updatedAt||item.at}],
  next:'可以查看相关设备，按当前需要调整日常设置。',
  steps:[{label:'已记录的服务进展',text:item.summary,at:item.updatedAt||item.at}],entries:[]
 })),records:[]};
}
export function guestConversationNotice(text){
 return /记忆|记住|偏好|习惯|家庭成员|添加成员|删除成员|认领|管理员|修改.*(?:空间|家庭)|删除.*(?:空间|设备)|添加设备|接入设备|开启.*(?:守护|照看|关怀)|开始.*(?:守护|照看|关怀)|结束.*(?:守护|照看|关怀)|睡眠守护|外出照看|长辈关怀/.test(text)
  ?'这项需要家庭成员处理。你可以继续查看空间近况，或告诉我想怎样调整日常设备。':null;
}
export function createGuestPages({memoryPage,profilePage,setView,toast}){
 const avatar='<span class="fu-guest-avatar mp-profile-avatar"><img src="assets/guest-avatar.svg" alt="未登录头像"></span>';
 function memory(){
  memoryPage.innerHTML='<header class="mm-header"><h1>记忆</h1></header><main class="gp-empty"><h2>记忆仅向家庭成员开放</h2><p>加入家庭后，可查看共享记忆和个人记忆。</p></main>';
  setView('memory');
 }
 function profile(open=true){
  profilePage.innerHTML=`<header class="mp-header">
    <h1>个人中心</h1>
    <div class="mp-header-decoration" aria-hidden="true"><img class="mp-header-art" src="assets/mine-header-art.png" alt=""><span class="mp-header-overlay"><img src="assets/mine-header-overlay.svg" alt=""></span></div>
    <div class="mp-profile gp-profile">${avatar}<span class="mp-profile-copy"><strong>访客</strong><small class="ac-profile-role">未登录</small></span></div>
  </header>
  <main class="mp-scroll">
    <section class="gp-empty gp-visitor-note">
      <h2>家庭资料仅向成员开放</h2>
      <p>加入家庭后，可查看和修改自己的资料。</p>
    </section>
  </main>`;
  if(open)setView('profile');
 }
 return {memory:{open:memory,refresh(){},onViewChange(){},back:memory},profile:{open:profile,refresh:()=>profile(false),onViewChange(){},back:profile,openSection(){toast('这项需要家庭成员使用');}}};
}
