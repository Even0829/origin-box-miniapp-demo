// Review controls live in the capsule menu, outside the product's interaction path.
export function installAccountReviewBridge(app){
 const embedded=parent!==window,targetOrigin=location.origin==='null'?'*':location.origin;
 let available=[],signature='';
 const send=actions=>{if(embedded)parent.postMessage({type:'origin-account-context',actions},targetOrigin);else document.dispatchEvent(new CustomEvent('account-review-context',{detail:actions}));};
 function update(){
  const nodes=[...app.querySelectorAll('[data-ac="preview-recipient"]')].filter(node=>!node.closest('[hidden]'));
  available=nodes;
  const actions=nodes.map((node,index)=>({id:'review-'+index,label:'切到邀请接收方'}));
  const next=JSON.stringify(actions);if(next!==signature){signature=next;send(actions);}
 }
 const observer=new MutationObserver(update);observer.observe(app,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
 const perform=id=>{const index=Number(String(id).replace('review-',''));available[index]?.click();};
 document.addEventListener('account-review-action',e=>perform(e.detail));
 window.addEventListener('message',e=>{if(e.source!==parent||location.origin!=='null'&&e.origin!==location.origin)return;if(e.data?.type==='origin-account-action')perform(e.data.id);});
 update();window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
 return {refresh:update};
}
