'use strict';
const works=window.GALLERY_ARTWORKS||[],dimensions=window.ARTWORK_DIMENSIONS||[];
const $=s=>document.querySelector(s),pad=n=>String(n).padStart(2,'0'),nameOf=a=>a.title&&a.title.trim().toLocaleLowerCase('ru')!=='без названия'?a.title.toLocaleUpperCase('ru'):'без названия';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const featured=[0, 15, 47, 44, 29, 32, 42, 46, 45, 48];
const order=[...featured,...works.map((_,i)=>i).filter(i=>!featured.includes(i))];
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobileView=matchMedia('(max-width:650px)');
const loopCount=order.length;
let mode='exhibition',activePosition=loopCount+2,selected=order[2],drag=null,dragged=false,scrollFrame=0,snapTimer=0,flight=null,returnFocus=null;
let loopSettleTimer=0,resizing=false,resizeTarget=null;
let field={x:0,y:0,scale:.45,ready:false},fieldDrag=null,fieldDragged=false,fieldLayer=50;
const fieldPointers=new Map();
let fieldGesture=null,fieldReleaseTimer=0,zoomPointer=null;
let detailTransition=null,swipeStart=null;
function ratio(i){return dimensions[i]?dimensions[i][0]/dimensions[i][1]:.8;}
function markStatus(t){$('#status').textContent=t;}
function makeRail(){
 for(let physical=0;physical<loopCount*3;physical++){
  const p=physical%loopCount,i=order[p],a=works[i],b=document.createElement('button');
  b.className='rail-card';b.dataset.index=i;b.dataset.position=physical;b.dataset.logical=p;
  b.setAttribute('aria-label','Рассмотреть «'+nameOf(a)+'»');
  if(physical<loopCount||physical>=loopCount*2){b.setAttribute('aria-hidden','true');b.tabIndex=-1;}
  b.style.setProperty('--ratio',Math.max(.38,Math.min(1.9,ratio(i))));
  b.innerHTML='<span class="rail-picture"><img src="'+esc(a.image)+'" alt="'+esc(nameOf(a))+'" loading="eager" draggable="false"></span>';
  b.onclick=()=>{if(dragged)return;openDetail(i,b);};$('#railTrack').append(b);
 }
}
function cardCenter(card){return card.offsetLeft+card.offsetWidth/2;}
function centerPosition(p,smooth=true){
 if(p<0||p>=loopCount*3)p=loopCount+((p%loopCount)+loopCount)%loopCount;
 const rail=$('#rail'),card=$('#railTrack').children[p];
 rail.scrollTo({left:cardCenter(card)-rail.clientWidth/2,behavior:smooth&&!reduceMotion?'smooth':'instant'});
}
function updateActive(){
 scrollFrame=0;if(resizing||mode!=='exhibition'||!$('#rail').clientWidth)return;const rail=$('#rail'),center=rail.scrollLeft+rail.clientWidth/2,cards=$('#railTrack').children;
 let nearest=0,distance=Infinity;
 for(let p=0;p<cards.length;p++){const d=Math.abs(cardCenter(cards[p])-center);if(d<distance){nearest=p;distance=d;}}
 activePosition=nearest;const logical=nearest%loopCount,a=works[order[logical]];
 for(let p=0;p<cards.length;p++){const active=p%loopCount===logical;cards[p].classList.toggle('is-current',active);cards[p].setAttribute('aria-current',active?'true':'false');}
 $('#currentTitle').textContent=nameOf(a);$('#progress>span').style.width=((logical+1)/loopCount*100)+'%';
}
function normalizeLoop(){
 if(drag||resizing||mode!=='exhibition'||!$('#rail').clientWidth)return;
 updateActive();const target=loopCount+activePosition%loopCount;
 if(target===activePosition)return;
 const rail=$('#rail'),cards=$('#railTrack').children;
 rail.scrollTo({left:rail.scrollLeft+cardCenter(cards[target])-cardCenter(cards[activePosition]),behavior:'instant'});
 activePosition=target;updateActive();
}
function setMode(next){
 if(mode===next)return;mode=next;document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!==next);document.querySelectorAll('.view-button').forEach(b=>{b.classList.toggle('active',b.dataset.mode===next);b.setAttribute('aria-pressed',String(b.dataset.mode===next));});
 document.body.dataset.mode=next;$('#footerLabel').textContent=next==='field'?'свободный маршрут':'бесконечная лента';$('#progress').hidden=next!=='exhibition';
 if(next==='exhibition'){const restore=activePosition;centerPosition(restore,false);updateActive();}if(next==='field'&&!field.ready)requestAnimationFrame(()=>{fitField();zoomField(innerWidth<=650?2.1:1.6);});
 markStatus(next==='field'?'Свободное поле работ':'Лента экспозиции');
}
function makeField(){
 const plane=$('#fieldPlane');
 order.forEach((i,p)=>{
  const a=works[i],b=document.createElement('button'),row=Math.floor(p/10),col=p%10;
  const w=[185,145,290,175,240,140,195,265][p%8],angle=p*2.399963,radius=Math.sqrt((p+.6)/order.length),x=1250+1080*radius*Math.cos(angle)-w/2,y=755+615*radius*Math.sin(angle)-90;
  b.className='field-art';b.dataset.index=i;b.style.left=x+'px';b.style.top=y+'px';b.style.width=w+'px';b.style.setProperty('--rotation',[0,-2,0,1,0,-1,0,0][p%8]+'deg');
  b.innerHTML='<img src="'+esc(a.image)+'" alt="'+esc(nameOf(a))+'" loading="eager" draggable="false">';
  b.setAttribute('aria-label','Рассмотреть «'+nameOf(a)+'»');b.onclick=()=>{if(!fieldDragged)openDetail(i,b);};b.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();const step=e.shiftKey?40:10;b.style.left=(parseFloat(b.style.left)+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0))+'px';b.style.top=(parseFloat(b.style.top)+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0))+'px';b.style.zIndex=String(++fieldLayer);markStatus('Картина перемещена');});plane.append(b);
 });
}
function applyField(){const el=$('#fieldPlane');el.style.transform='translate('+field.x+'px,'+field.y+'px) scale('+field.scale+')';$('#fieldZoom').value=String(Math.round(field.scale*100));}
function fitField(){
 const r=$('#fieldViewport').getBoundingClientRect();field.scale=Math.min(r.width/2500,(r.height-40)/1550)*.91;field.scale=Math.max(.14,field.scale);field.x=(r.width-2500*field.scale)/2;field.y=(r.height-1550*field.scale)/2+10;field.ready=true;applyField();
}
function zoomField(factor,cx,cy){
 const r=$('#fieldViewport').getBoundingClientRect();cx=cx??r.width/2;cy=cy??r.height/2;const prev=field.scale,next=Math.max(.14,Math.min(1.6,prev*factor));field.x=cx-(cx-field.x)*next/prev;field.y=cy-(cy-field.y)*next/prev;field.scale=next;applyField();
}
function showWork(i){
 selected=i;const a=works[i],p=order.indexOf(i);$('#detailImage').src=a.image;$('#detailImage').alt=nameOf(a);$('#artTitle').textContent=nameOf(a);$('#artNumber').textContent='РАБОТА / '+pad(i+1);$('#detailCounter').textContent=pad(p+1)+' / '+works.length;$('#artMedium').textContent=a.medium||'Материалы не указаны';$('#artSize').textContent=a.size||'Не указан';$('#artYear').textContent=String(a.creation_year);$('#backLabel').textContent=mode==='field'?'В поле':'К экспозиции';
 $('#artDescription').replaceChildren();if(a.narrative_description)a.narrative_description.split(/\n\s*\n/).filter(Boolean).forEach(t=>{const el=document.createElement('p');el.textContent=t;$('#artDescription').append(el);});
 $('.story-label').hidden=!a.narrative_description;
 const previous=works[order[(p-1+order.length)%order.length]],next=works[order[(p+1)%order.length]];$('#previousThumb').src=previous.image;$('#nextThumb').src=next.image;$('#previousWorkName').textContent=nameOf(previous);$('#nextWorkName').textContent=nameOf(next);$('#detailInfo').scrollTop=0;$('#detail').scrollTop=0;
}
function openDetail(i,origin){
 returnFocus=origin||document.activeElement;const original=origin?.querySelector('img'),from=original?.getBoundingClientRect();showWork(i);$('#detail').showModal();
 if(!reduceMotion&&original&&from.width>20){
  const target=$('#detailImage'),to=target.getBoundingClientRect(),clone=original.cloneNode();clone.className='flight-image';clone.removeAttribute('id');clone.setAttribute('aria-hidden','true');Object.assign(clone.style,{left:from.left+'px',top:from.top+'px',width:from.width+'px',height:from.height+'px'});$('#detail').append(clone);target.style.opacity='0';
  flight=clone.animate([{transform:'translate(0,0) scale(1,1)'},{transform:'translate('+(to.left-from.left)+'px,'+(to.top-from.top)+'px) scale('+(to.width/from.width)+','+(to.height/from.height)+')'}],{duration:520,easing:'cubic-bezier(.22,.8,.2,1)',fill:'forwards'});
  const cleanup=()=>{clone.remove();target.style.opacity='';flight=null;};flight.finished.then(cleanup,cleanup);
 }
}
function closeDetail(){if(flight)flight.cancel();$('#detail').close();}
function advanceWork(delta){if(flight)flight.cancel();if(detailTransition)detailTransition.cancel();const p=order.indexOf(selected);showWork(order[(p+delta+order.length)%order.length]);if(!reduceMotion)detailTransition=$('.detail-body').animate([{opacity:.25,transform:'translateX('+(delta>0?18:-18)+'px)'},{opacity:1,transform:'translateX(0)'}],{duration:240,easing:'cubic-bezier(.22,.8,.2,1)'});}
$('#detail').addEventListener('close',()=>{activePosition=loopCount+order.indexOf(selected);if(mode==='exhibition')centerPosition(activePosition,false);if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});});
document.querySelectorAll('.view-button').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));$('#home').onclick=e=>{e.preventDefault();setMode('exhibition');centerPosition(loopCount+2);};
$('#rail').addEventListener('scroll',()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(updateActive);clearTimeout(loopSettleTimer);loopSettleTimer=setTimeout(normalizeLoop,160);},{passive:true});
$('#rail').addEventListener('scrollend',normalizeLoop);
$('#rail').addEventListener('wheel',e=>{if(e.ctrlKey)return;e.preventDefault();$('#rail').scrollLeft+=(Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY)*1.05;clearTimeout(snapTimer);snapTimer=setTimeout(()=>centerPosition(activePosition),150);},{passive:false});
$('#rail').addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0)return;drag={x:e.clientX,left:$('#rail').scrollLeft,id:e.pointerId};dragged=false;});
$('#rail').addEventListener('pointermove',e=>{if(!drag)return;const d=e.clientX-drag.x;if(Math.abs(d)>5){dragged=true;$('#rail').classList.add('dragging');$('#rail').setPointerCapture(drag.id);$('#rail').scrollLeft=drag.left-d;}});
function endRailDrag(){if(!drag)return;drag=null;$('#rail').classList.remove('dragging');if(dragged){updateActive();centerPosition(activePosition);setTimeout(()=>dragged=false,50);}}
$('#rail').addEventListener('pointerup',endRailDrag);$('#rail').addEventListener('pointercancel',endRailDrag);$('#rail').addEventListener('lostpointercapture',endRailDrag);
$('#railPrevious').onclick=()=>centerPosition(activePosition-1);$('#railNext').onclick=()=>centerPosition(activePosition+1);$('#currentOpen').onclick=()=>openDetail(order[activePosition%loopCount],$('#railTrack').children[activePosition]);
const fieldViewport=$('#fieldViewport'),fieldSlider=$('#fieldZoom');
function clearFieldDrag(restore=false){
 if(fieldDrag?.art){const art=fieldDrag.art;art.classList.remove('is-moving');if(restore){art.style.left=fieldDrag.startX+'px';art.style.top=fieldDrag.startY+'px';}}
 fieldDrag=null;
}
function touchPair(){return [...fieldPointers.values()].filter(p=>p.type==='touch').slice(0,2);}
function startFieldPinch(){
 const points=touchPair();if(points.length<2)return false;
 clearFieldDrag(true);clearTimeout(fieldReleaseTimer);
 const r=fieldViewport.getBoundingClientRect(),cx=(points[0].x+points[1].x)/2-r.left,cy=(points[0].y+points[1].y)/2-r.top;
 fieldGesture={distance:Math.max(1,Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y)),scale:field.scale,worldX:(cx-field.x)/field.scale,worldY:(cy-field.y)/field.scale};
 fieldDragged=true;fieldViewport.classList.add('dragging');
 for(const [id,p] of fieldPointers)if(p.type==='touch')fieldViewport.setPointerCapture(id);
 return true;
}
fieldViewport.addEventListener('pointerdown',e=>{
 if(e.button!==0)return;
 fieldPointers.set(e.pointerId,{x:e.clientX,y:e.clientY,type:e.pointerType});
 if(touchPair().length===2){e.preventDefault();startFieldPinch();return;}
 if(fieldDrag||fieldGesture)return;
 clearTimeout(fieldReleaseTimer);const art=e.target.closest('.field-art');
 fieldDrag={kind:art?'art':'pan',art,x:e.clientX,y:e.clientY,startX:art?parseFloat(art.style.left):field.x,startY:art?parseFloat(art.style.top):field.y,id:e.pointerId,scale:field.scale};fieldDragged=false;
});
fieldViewport.addEventListener('pointermove',e=>{
 const point=fieldPointers.get(e.pointerId);if(!point)return;point.x=e.clientX;point.y=e.clientY;
 if(fieldGesture){
  e.preventDefault();const points=touchPair();if(points.length<2)return;
  const r=fieldViewport.getBoundingClientRect(),cx=(points[0].x+points[1].x)/2-r.left,cy=(points[0].y+points[1].y)/2-r.top;
  const distance=Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y),scale=Math.max(.14,Math.min(1.6,fieldGesture.scale*distance/fieldGesture.distance));
  field.x=cx-fieldGesture.worldX*scale;field.y=cy-fieldGesture.worldY*scale;field.scale=scale;applyField();return;
 }
 if(!fieldDrag||e.pointerId!==fieldDrag.id)return;
 const dx=e.clientX-fieldDrag.x,dy=e.clientY-fieldDrag.y;if(Math.hypot(dx,dy)<=5&&!fieldDragged)return;
 fieldDragged=true;fieldViewport.setPointerCapture(fieldDrag.id);fieldViewport.classList.add('dragging');
 if(fieldDrag.kind==='art'){
  const art=fieldDrag.art;if(!art.classList.contains('is-moving'))art.style.zIndex=String(++fieldLayer);
  art.classList.add('is-moving');art.style.left=(fieldDrag.startX+dx/fieldDrag.scale)+'px';art.style.top=(fieldDrag.startY+dy/fieldDrag.scale)+'px';
 }else{field.x=fieldDrag.startX+dx;field.y=fieldDrag.startY+dy;applyField();}
});
function endFieldPointer(e){
 if(!fieldPointers.has(e.pointerId))return;fieldPointers.delete(e.pointerId);
 if(fieldGesture){
  if(touchPair().length>=2){startFieldPinch();return;}fieldGesture=null;clearFieldDrag();
  const remaining=[...fieldPointers.entries()][0];
  if(remaining){const [id,p]=remaining;fieldDrag={kind:'pan',art:null,x:p.x,y:p.y,startX:field.x,startY:field.y,id,scale:field.scale};return;}
 }else if(fieldDrag?.id===e.pointerId)clearFieldDrag(e.type==='pointercancel');
 if(!fieldPointers.size){fieldViewport.classList.remove('dragging');clearTimeout(fieldReleaseTimer);fieldReleaseTimer=setTimeout(()=>fieldDragged=false,250);}
}
fieldViewport.addEventListener('pointerup',endFieldPointer);fieldViewport.addEventListener('pointercancel',endFieldPointer);
fieldViewport.addEventListener('lostpointercapture',e=>{if(e.target===fieldViewport)endFieldPointer(e);});
fieldViewport.addEventListener('wheel',e=>{if(e.ctrlKey)return;if(fieldDrag||fieldGesture){e.preventDefault();return;}e.preventDefault();const r=fieldViewport.getBoundingClientRect();zoomField(Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top);},{passive:false});
fieldSlider.addEventListener('input',e=>zoomField(Number(e.target.value)/(field.scale*100)));
function zoomFromPointer(e){
 const r=fieldSlider.getBoundingClientRect(),min=Number(fieldSlider.min),max=Number(fieldSlider.max),step=Number(fieldSlider.step)||1;
 const fraction=Math.max(0,Math.min(1,(e.clientX-r.left-3.5)/Math.max(1,r.width-7))),value=min+Math.round(fraction*(max-min)/step)*step;
 zoomField(value/(field.scale*100));
}
fieldSlider.addEventListener('pointerdown',e=>{if(e.button!==0||(!mobileView.matches&&e.pointerType!=='touch'))return;e.preventDefault();zoomPointer=e.pointerId;fieldSlider.setPointerCapture(e.pointerId);zoomFromPointer(e);});
fieldSlider.addEventListener('pointermove',e=>{if(e.pointerId===zoomPointer){e.preventDefault();zoomFromPointer(e);}});
function endZoomPointer(e){if(e.pointerId===zoomPointer)zoomPointer=null;}
fieldSlider.addEventListener('pointerup',endZoomPointer);fieldSlider.addEventListener('pointercancel',endZoomPointer);fieldSlider.addEventListener('lostpointercapture',endZoomPointer);
$('#imageStage').addEventListener('pointerdown',e=>{if(e.button===0)swipeStart={x:e.clientX,y:e.clientY,id:e.pointerId};});
$('#imageStage').addEventListener('pointerup',e=>{if(!swipeStart||e.pointerId!==swipeStart.id)return;const dx=e.clientX-swipeStart.x,dy=e.clientY-swipeStart.y;swipeStart=null;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.5)advanceWork(dx<0?1:-1);});
$('#imageStage').addEventListener('pointercancel',()=>swipeStart=null);
$('#detailClose').onclick=closeDetail;$('#previousArt').onclick=()=>advanceWork(-1);$('#nextArt').onclick=()=>advanceWork(1);
$('#aboutOpen').onclick=()=>$('#about').showModal();$('#aboutClose').onclick=()=>$('#about').close();$('#aboutExplore').onclick=()=>{$('#about').close();setMode('exhibition');};
document.addEventListener('pointerdown',()=>{document.body.dataset.input='pointer';},{capture:true});
document.addEventListener('keydown',e=>{if(e.key==='Tab')document.body.dataset.input='keyboard';},{capture:true});
document.addEventListener('keydown',e=>{
 if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
 if($('#detail').open){if(e.key==='ArrowRight'){e.preventDefault();advanceWork(1);}if(e.key==='ArrowLeft'){e.preventDefault();advanceWork(-1);}return;}if($('#about').open)return;
 if(mode==='exhibition'){if(e.key==='ArrowRight'){e.preventDefault();centerPosition(activePosition+1);}if(e.key==='ArrowLeft'){e.preventDefault();centerPosition(activePosition-1);}}
 if(mode==='field'&&['ArrowRight','ArrowLeft','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();field.x+=e.key==='ArrowRight'?-100:e.key==='ArrowLeft'?100:0;field.y+=e.key==='ArrowDown'?-100:e.key==='ArrowUp'?100:0;applyField();}
});
let resizeTimer,lastViewport={w:innerWidth,h:innerHeight};window.addEventListener('resize',()=>{if(!resizing){resizeTarget=activePosition;resizing=true;}clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(mode==='exhibition')centerPosition(resizeTarget,false);if(field.ready){field.x+=(innerWidth-lastViewport.w)/2;field.y+=(innerHeight-lastViewport.h)/2;applyField();}lastViewport={w:innerWidth,h:innerHeight};resizing=false;resizeTarget=null;if(mode==='exhibition')updateActive();},100);});
makeRail();makeField();requestAnimationFrame(()=>{centerPosition(loopCount+2,false);updateActive();});
