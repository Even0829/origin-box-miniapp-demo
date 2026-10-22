// Adapted from the user's int-aios-space-graph.zip. Original preserved in vendor/.
// Position, node geometry and halo breathing remain independent.
export function createSpaceGraph({canvas,hitLayer,rooms,onSelect,onInteraction,onFrame}) {
  const ctx=canvas.getContext('2d');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  // Six balanced directions; depth is subtle so the default silhouette stays open.
  const layout=[ [310,-155,15],[0,-265,-15],[310,155,10],[-310,-155,15],[-310,155,10],[0,265,-15] ];
  let nodes=[],points=[],w=1,h=1,unit=1,ox=0,oy=0,angleY=.06,angleX=-.12,zoom=1,time=0,last=0,selected='',hover=-1,drag=null,frame=0,paused=false,destroyed=false;
  const rgba=(hex,a)=>`rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${a})`;
  const circle=(x,y,r,color)=>{ctx.beginPath();ctx.arc(x,y,Math.max(.1,r),0,Math.PI*2);ctx.fillStyle=color;ctx.fill();};
  const hex=(x,y,r)=>{ctx.beginPath();for(let j=0;j<6;j++){const a=j*Math.PI/3-Math.PI/2;const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;j?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();};
  function rotate([x,y,z]){const cy=Math.cos(angleY),sy=Math.sin(angleY),cx=Math.cos(angleX),sx=Math.sin(angleX),xx=x*cy+z*sy,zz=-x*sy+z*cy;return[xx,y*cx-zz*sx,y*sx+zz*cx];}
  function project(p){const[x,y,z]=rotate(p),s=850/(850+z)*unit*zoom;return{x:ox+x*s,y:oy+y*s,z,s};}
  function path(a,b,t){return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t+Math.sin(t*Math.PI)*6*unit};}
  function resize(){const box=canvas.getBoundingClientRect();w=box.width;h=box.height;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,w*dpr);canvas.height=Math.max(1,h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);unit=Math.min(w*.9/760,h*.83/610);ox=w*.5;oy=h*.49;}
  const observer=new ResizeObserver(resize);observer.observe(canvas);
  function setRooms(next){
    const existing=new Map(nodes.map(n=>[n.id,n]));
    nodes=[{id:'core',name:'INT AIOS',color:'#79beff',p:[0,0,0],target:[0,0,0]},...next.map((r,i)=>{
      const old=existing.get(r.id),a=i<layout.length?layout[i]:[Math.cos(i/next.length*Math.PI*2)*290,Math.sin(i/next.length*Math.PI*2)*235,0];
      return{id:r.id,name:r.name,color:r.color,p:old?.p??[...a],target:old?.target??[...a]};
    })];
    hitLayer.replaceChildren();
    for(const n of nodes){const button=document.createElement('button');button.className='graph-node-button';button.dataset.room=n.id;button.setAttribute('aria-label',n.id==='core'?'打开小元的意识空间':`查看${n.name}状态`);button.title=n.id==='core'?'小元的意识空间':n.name;const label=document.createElement('span');label.className='graph-node-label';label.textContent=n.name;label.setAttribute('aria-hidden','true');button.append(label);button.addEventListener('click',e=>{if(e.detail===0){selected=n.id;onInteraction(false);onSelect(n.id);}});hitLayer.append(button);}
    if(!nodes.some(n=>n.id===selected))selected=next[0]?.id??'core';
  }
  function draw(ts){
    if(destroyed||document.hidden)return;
    const dt=Math.min((ts-last)/1000||0,.04);last=ts;if(!paused&&!reduced.matches)time+=dt;
    for(const n of nodes)n.p=n.p.map((v,k)=>v+(n.target[k]-v)*Math.min(1,dt*15));
    ctx.clearRect(0,0,w,h);
    const aura=ctx.createRadialGradient(ox,oy,2,ox,oy,Math.max(1,135*unit));aura.addColorStop(0,'rgba(76,143,229,.055)');aura.addColorStop(1,'transparent');ctx.fillStyle=aura;ctx.fillRect(0,0,w,h);
    points=nodes.map((n,i)=>project([n.p[0],n.p[1]+(i===0||drag?.index===i?0:Math.sin(time*1.15+i*.78)*7),n.p[2]]));
    for(let i=1;i<nodes.length;i++){
      const a=points[0],b=points[i],active=selected===nodes[i].id||hover===i,c=nodes[i].color;
      ctx.beginPath();for(let j=0;j<=35;j++){const p=path(a,b,j/35);j?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);}ctx.strokeStyle=rgba(c,active?.55:.29);ctx.lineWidth=active?1.1:.7;ctx.stroke();
      for(let k=0;k<2;k++){const t=(time*(.14+i*.007)+k/2+i*.11)%1;for(let j=9;j>=0;j--){const tt=t-j*.008;if(tt<0)continue;const p=path(a,b,tt);circle(p.x,p.y,j===0?1.3:.65,rgba(c,(1-j/10)*.6));}}
    }
    [...nodes.keys()].sort((a,b)=>points[b].z-points[a].z).forEach(i=>{
      const n=nodes[i],p=points[i],core=i===0,active=selected===n.id||hover===i,r=(core?25:11)*Math.max(.65,p.s),c=n.color,glowScale=1+Math.sin(time*1.8+i*.74)*.18,glowRadius=r*(core?3.8:3.2)*glowScale;
      const glow=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,glowRadius);glow.addColorStop(0,rgba(c,.28));glow.addColorStop(.4,rgba(c,.11));glow.addColorStop(1,rgba(c,0));ctx.fillStyle=glow;ctx.fillRect(p.x-glowRadius,p.y-glowRadius,glowRadius*2,glowRadius*2);
      ctx.strokeStyle=rgba(c,active?.65:.2);ctx.lineWidth=.6;ctx.beginPath();ctx.arc(p.x,p.y,r*(core?1.65:1.9),0,Math.PI*2);ctx.stroke();hex(p.x,p.y,r*1.4);ctx.fillStyle=rgba(c,.075);ctx.fill();ctx.strokeStyle=rgba(c,.48);ctx.stroke();
      ctx.shadowBlur=core?15:9;ctx.shadowColor=c;hex(p.x,p.y,r);const g=ctx.createLinearGradient(p.x-r,p.y-r,p.x+r,p.y+r);g.addColorStop(0,'#def2ff');g.addColorStop(.4,c);g.addColorStop(1,core?'#397cdd':c);ctx.fillStyle=g;ctx.fill();ctx.shadowBlur=0;
      if(core){hex(p.x,p.y,r*.48);ctx.fillStyle='#f7fcff';ctx.fill();}
      // Labels use the DOM layer to stay sharp at the display's native pixel ratio.
    });
    const buttons=hitLayer.children,ratio=devicePixelRatio||1;points.forEach((p,i)=>{if(buttons[i]){buttons[i].style.left=`${Math.round(p.x*ratio)/ratio}px`;buttons[i].style.top=`${Math.round(p.y*ratio)/ratio}px`;buttons[i].setAttribute('aria-pressed',selected===nodes[i].id);}});
    onFrame?.(Object.fromEntries(nodes.map((n,i)=>[n.id,points[i]])),{width:w,height:h});
    frame=requestAnimationFrame(draw);
  }
  function local(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
  function hit(x,y){return points.map((p,i)=>({i,d:Math.hypot(p.x-x,p.y-y),z:p.z})).filter(p=>p.d<(p.i===0?27:23)).sort((a,b)=>a.z-b.z)[0]?.i??-1;}
  function down(e){if(drag||e.button>0||e.target.closest('.space-state'))return;const p=local(e),target=e.target.closest('.graph-node-button');const i=target?nodes.findIndex(n=>n.id===target.dataset.room):hit(p.x,p.y);drag={index:i,x:p.x,y:p.y,startX:p.x,startY:p.y,id:e.pointerId,moved:false};canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';onInteraction(true);}
  function move(e){const p=local(e);if(!drag){hover=hit(p.x,p.y);canvas.style.cursor=hover>=0?'pointer':'grab';return;}if(e.pointerId!==drag.id)return;const dx=p.x-drag.x,dy=p.y-drag.y;if(Math.hypot(p.x-drag.startX,p.y-drag.startY)>5)drag.moved=true;if(drag.moved){if(drag.index>0){const i=drag.index,s=points[i].s,cy=Math.cos(angleY),sy=Math.sin(angleY),cx=Math.cos(angleX),sx=Math.sin(angleX);nodes[i].target[0]=Math.max(-330,Math.min(330,nodes[i].target[0]+cy*dx/s+sy*sx*dy/s));nodes[i].target[1]=Math.max(-245,Math.min(245,nodes[i].target[1]+cx*dy/s));nodes[i].target[2]+=sy*dx/s-cy*sx*dy/s;}else if(drag.index<0){angleY+=dx*.003;angleX=Math.max(-.55,Math.min(.55,angleX+dy*.003));}}drag.x=p.x;drag.y=p.y;}
  function up(e){if(!drag||e.pointerId!==drag.id)return;const current=drag;drag=null;canvas.style.cursor='grab';if(current.index>=0){selected=nodes[current.index].id;onSelect(selected);}onInteraction(false);}
  function cancel(){if(drag){drag=null;onInteraction(false);}canvas.style.cursor='grab';}
  const region=canvas.parentElement;region.addEventListener('pointerdown',down);region.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('lostpointercapture',cancel);
  function visibility(){cancelAnimationFrame(frame);if(!document.hidden){last=0;frame=requestAnimationFrame(draw);}}
  document.addEventListener('visibilitychange',visibility);
  setRooms(rooms);resize();frame=requestAnimationFrame(draw);
  return{setRooms,select(id){selected=id;},setPaused(value){paused=value;},reset(){angleX=-.12;angleY=.06;zoom=1;nodes.forEach((n,i)=>n.target=i===0?[0,0,0]:[...(layout[i-1]??[0,230,0])]);},destroy(){destroyed=true;cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',visibility);region.removeEventListener('pointerdown',down);region.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',cancel);canvas.removeEventListener('lostpointercapture',cancel);}};
}
