// All identities, discovery results and acknowledgements below are local fixtures.
export const INVITE_CODE='682915';
export function createFirstUseState({scenario='visitor',onChange=()=>{},onComplete=()=>{},delay=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id)}={}){
  const unbound=scenario.startsWith('unbound-');
  const state={scenario,loggedIn:scenario==='signed'||unbound,page:'home',tab:'home',intent:null,login:false,loginBusy:false,phase:'',error:'',boxes:[],selected:null,code:'',invitation:null,role:unbound?scenario.endsWith('member')?'member':'admin':null,family:unbound?'潘多拉的家':null};
  const initialFamily=state.family;
  let timers=new Set(),version=0,disposed=false,activated=false,joined=false;
  const emit=()=>{if(!disposed)onChange(structuredClone(state));};
  function stop(){version++;for(const id of timers)cancel(id);timers.clear();}
  function later(fn,ms=900){const token=version;const id=delay(()=>{timers.delete(id);if(!disposed&&token===version)fn();},ms);timers.add(id);}
  function complete(role){onComplete(role,{family:state.family});}
  function start(intent){stop();state.intent=intent;state.error='';if(!state.loggedIn){state.login=true;emit();}else proceed();}
  function proceed(){state.login=false;if(state.intent==='connect')search();else{state.page='join';state.phase='code';state.invitation=null;if(state.scenario==='invite'){state.code=INVITE_CODE;verify(INVITE_CODE);}else if(state.code.length===6)verify(state.code);else emit();}}
  function login(){if(state.loginBusy)return;state.loginBusy=true;state.error='';emit();later(()=>{if(state.scenario==='login-failed'){state.scenario='visitor';state.loginBusy=false;state.error='微信登录暂未完成，请重试';emit();return;}state.loggedIn=true;state.loginBusy=false;proceed();});}
  function cancelLogin(){stop();state.login=false;state.loginBusy=false;emit();}
  function search(){stop();state.page='connect';state.phase='searching';state.error='';state.boxes=[];emit();later(()=>{
    if(state.scenario==='permission'){state.phase='permission';emit();return;}
    if(state.scenario==='not-found'){state.phase='not-found';emit();return;}
    state.boxes=[{id:'box-0829',name:'引元盒子',number:'0829',claimed:state.scenario==='claimed'},...(state.scenario==='multiple'?[{id:'box-0618',name:'引元盒子',number:'0618',claimed:false}]:[])];state.selected=state.boxes.length===1?state.boxes[0].id:null;state.phase='found';emit();
  },1200);}
  function retrySearch(){if(['permission','not-found'].includes(state.scenario))state.scenario='visitor';search();}
  function select(id){if(state.phase!=='found'||!state.boxes.some(b=>b.id===id))return;state.selected=id;emit();}
  function activate(){const box=state.boxes.find(b=>b.id===state.selected);if(!box||box.claimed||!['found','activation-error'].includes(state.phase))return;stop();state.phase='activating';state.error='';emit();later(()=>{if(state.scenario==='activation-failed'){state.scenario='visitor';state.phase='activation-error';state.error='暂时未能完成激活，请保持网络连接后重试';emit();return;}activated=true;sync();},1400);}
  function sync(){stop();state.page='connect';state.phase='syncing';state.role='admin';state.family=initialFamily||'我的家';emit();later(()=>{if(state.scenario==='sync-failed'){state.scenario='visitor';state.phase='sync-error';emit();return;}complete('admin');},1100);}
  function verify(value){if(state.phase==='joining')return;stop();state.code=String(value).replace(/\D/g,'').slice(0,6);state.error='';state.invitation=null;if(state.code.length!==6){state.phase='code';emit();return;}state.phase='verifying';emit();later(()=>{if(state.code!==INVITE_CODE){state.phase='code';state.error=state.code==='000000'?'这份邀请已过期，请家人重新发送':'邀请码不正确，请核对后再试';emit();return;}state.phase='invitation';state.invitation={family:'潘多拉的家',inviter:'潘多拉',role:'家庭成员'};emit();},650);}
  function join(){if(state.phase!=='invitation'||!state.invitation)return;stop();state.phase='joining';emit();later(()=>{joined=true;state.family=state.invitation.family;state.role='member';complete('member');},1100);}
  function back(){if(joined){complete('member');return;}stop();state.page='home';state.phase=activated?'sync-pending':'';state.error='';state.login=false;state.loginBusy=false;state.tab='home';emit();}
  function tab(value){if(!['home','devices','memory','profile'].includes(value))return;stop();state.page='home';state.tab=value;state.error='';emit();}
  return {getState:()=>structuredClone(state),start,login,cancelLogin,search,retrySearch,select,activate,sync,verify,join,back,tab,destroy(){stop();disposed=true;}};
}
