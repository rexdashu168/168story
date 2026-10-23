/* 等待輪迴 小說館：單頁閱讀網站（不需要建置，直接放到任何靜態主機） */
(function(){
'use strict';
var PRE=window.__PRE||null;          // 預覽檔才會有：把資料與圖片內嵌進同一個檔
var app=document.getElementById('app');
var SITE=null, WORKS=[], EPS={};     // EPS[作品id] = {episodes}
var ERAS=[['all','全部'],['1998','1998 劇團'],['古代','古代故事']];
var RANGE=30, timer=null;
var ui={tab:'intro',range:0,mode:null,era:'all'};

/* ---------- 小工具 ---------- */
var store={
  get:function(k,d){try{var v=localStorage.getItem('dl_'+k);return v===null?d:JSON.parse(v)}catch(e){return d}},
  set:function(k,v){try{localStorage.setItem('dl_'+k,JSON.stringify(v))}catch(e){}},
  del:function(k){try{localStorage.removeItem('dl_'+k)}catch(e){}}
};
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function zh(n){var d='零一二三四五六七八九';if(n<=10)return n===10?'十':d[n];if(n<20)return'十'+d[n%10];return d[Math.floor(n/10)]+'十'+(n%10?d[n%10]:'')}
function src(p){return PRE&&PRE.img[p]?PRE.img[p]:p}
function wbase(w){return'works/'+w.id+'/'}
function wimg(w,p){return src(wbase(w)+p)}
function work(id){for(var i=0;i<WORKS.length;i++)if(WORKS[i].id===id)return WORKS[i];return null}
function ready(e){return e.status==='ready'||e.status==='draft'}   // draft 只會出現在私人預覽檔
function tt(e){return e.status==='planned'?'規劃中':e.title}
function eraName(e){return e.era==='古代'?'古代故事':'1998 劇團'}
function pubCount(d){return d.episodes.filter(function(e){return e.status==='ready'}).length}
function latest(d){var r=d.episodes.filter(function(e){return e.status==='ready'});return r.length?r[r.length-1]:null}
function getJSON(p){
  if(PRE&&PRE.json[p])return Promise.resolve(PRE.json[p]);
  return fetch(p,{cache:'no-cache'}).then(function(r){if(!r.ok)throw new Error(p);return r.json()});
}
function getText(p){
  if(PRE&&PRE.text[p]!=null)return Promise.resolve(PRE.text[p]);
  return fetch(p,{cache:'no-cache'}).then(function(r){if(!r.ok)throw new Error(p);return r.text()});
}
function loadEps(w){
  if(EPS[w.id])return Promise.resolve(EPS[w.id]);
  return getJSON(wbase(w)+'episodes.json').then(function(j){EPS[w.id]=j;return j});
}
function toast(t){var d=document.createElement('div');d.className='toast';d.textContent=t;document.body.appendChild(d);setTimeout(function(){d.remove()},1600)}
function ranges(n){var r=[];for(var a=1;a<=n;a+=RANGE)r.push([a,Math.min(n,a+RANGE-1)]);return r}
function rangeOf(n){return Math.floor((n-1)/RANGE)}

/* 閱讀紀錄 */
function lastEp(id){return store.get('last_'+id,0)}
function readSet(id){return store.get('read_'+id,[])}
function markRead(id,n){var s=readSet(id);if(s.indexOf(n)<0){s.push(n);store.set('read_'+id,s)}}
function favs(){return store.get('fav',[])}
function touchRecent(id,n){var r=store.get('recent',[]).filter(function(x){return x.id!==id});r.unshift({id:id,ep:n,t:Date.now()});store.set('recent',r.slice(0,20))}

/* ---------- 路由 ---------- */
// #/  #/fav  #/me  #/soon  #/w/作品  #/w/作品/集數
function route(){
  clearInterval(timer);
  var go=ls.next;ls.next=false;if(!go)lsStop();   // 聽完一集自動接下一集時，聲音不停、播放列留著
  document.querySelectorAll('.mask,.sheet').forEach(function(x){x.remove()});
  if(onScroll){window.removeEventListener('scroll',onScroll);onScroll=null}   // 離開閱讀頁就不再記位置
  var h=location.hash.replace(/^#\/?/,'').split('/');
  if(h[0]==='w'&&work(h[1])){var w=work(h[1]);return loadEps(w).then(function(){h[2]?reader(w,+h[2]):workPage(w)}).catch(fail)}
  if(h[0]==='fav')return favPage();
  if(h[0]==='me')return mePage();
  if(h[0]==='soon')return soonPage();
  home();
}
function fail(){app.className='wrap';app.innerHTML='<div class="empty"><div class="big">⚠</div>資料讀取失敗，請重新整理。</div>'}
function nav(on){
  var I={home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
         fav:'<path d="M6 3h12v18l-6-4-6 4z"/>',
         me:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'};
  return'<div class="nav">'+[['home','#/','首頁'],['fav','#/fav','收藏'],['me','#/me','我的']].map(function(x){
    return'<a href="'+x[1]+'"'+(x[0]===on?' class="on"':'')+'><svg viewBox="0 0 24 24">'+I[x[0]]+'</svg>'+x[2]+'</a>'}).join('')+'</div>';
}
function carousel(imgs,cap){
  return'<div class="hero">'+imgs.map(function(s,i){return'<img src="'+s+'" alt=""'+(i?'':' class="on"')+'>'}).join('')+
    (cap?'<div class="cap">'+cap+'</div>':'')+
    '<div class="dots">'+imgs.map(function(s,i){return'<i'+(i?'':' class="on"')+'></i>'}).join('')+'</div></div>';
}
function startCarousel(){
  var imgs=app.querySelectorAll('.hero img'),dots=app.querySelectorAll('.dots i'),k=0;
  if(imgs.length<2)return;
  timer=setInterval(function(){imgs[k].classList.remove('on');dots[k].classList.remove('on');k=(k+1)%imgs.length;imgs[k].classList.add('on');dots[k].classList.add('on')},4500);
}

/* ---------- 首頁 ---------- */
function home(){
  Promise.all(WORKS.map(loadEps)).then(function(){
    var heroes=[];WORKS.forEach(function(w){w.hero.forEach(function(p){heroes.push(wimg(w,p))})});
    var rec=store.get('recent',[]).filter(function(x){return work(x.id)})[0];
    var h='<div class="top"><h1>'+esc(SITE.name)+'</h1></div>'+carousel(heroes);
    if(rec){var w=work(rec.id),e=EPS[w.id].episodes[rec.ep-1];
      h+='<div class="sec"><h2>繼續閱讀</h2></div><div class="cont"><img src="'+wimg(w,w.cover)+'" alt=""><div class="t"><b>'+esc(w.title)+'－'+esc(w.subtitle)+'</b><span>讀到第 '+rec.ep+' 集・'+esc(e?tt(e):'')+'</span></div><button class="go" data-go="#/w/'+w.id+'/'+rec.ep+'">繼續</button></div>'}
    h+='<div class="sec"><h2>全部作品</h2><small>'+WORKS.length+' 部</small></div><div class="shelf">'+WORKS.map(bookCard).join('')+
       '<a class="book soon" href="#/soon"><div class="pic"><img src="soon/card.jpg" alt=""><span class="lbl">敬請期待</span></div><b>下一部作品</b><small>籌備中・先睹為快</small></a></div>';
    app.className='wrap hasnav';app.innerHTML=h+nav('home');
    bindGo();startCarousel();
  }).catch(fail);
}
function bookCard(w){
  var d=EPS[w.id],n=d.episodes.length,r=pubCount(d);
  return'<a class="book" href="#/w/'+w.id+'"><div class="pic"><img src="'+wimg(w,w.cover)+'" alt=""><span class="badge">'+esc(w.status)+'</span><span class="cnt">共 '+n+' 集</span></div>'+
    '<b>'+esc(w.title)+'－'+esc(w.subtitle)+'</b><small>已上架 '+r+' 集</small></a>';
}
function bindGo(){app.querySelectorAll('[data-go]').forEach(function(b){b.onclick=function(){location.hash=b.dataset.go}})}

/* ---------- 作品頁 ---------- */
function workPage(w){
  var d=EPS[w.id],last=lastEp(w.id),fav=favs().indexOf(w.id)>=0,n=d.episodes.length,rd=readSet(w.id).length;
  if(ui.mode===null)ui.mode=store.get('mode','grid');
  ui.range=rangeOf(last||1);
  var h=carousel(w.hero.map(function(p){return wimg(w,p)}))+'<button class="back" data-go="#/" aria-label="回首頁">‹</button>'+
   '<div class="info"><img class="cover" src="'+wimg(w,w.cover)+'" alt=""><div><h1>'+esc(w.title)+'</h1><div class="st">'+esc(w.subtitle)+'</div>'+
   (pubCount(d)===n?'<div class="meta">全 '+n+' 集・'+esc(w.status)+'</div>':'<div class="meta">共 '+n+' 集・已上架 '+pubCount(d)+' 集</div>'+(latest(d)?'<div class="meta">最新：第 '+latest(d).ep+' 集・'+esc(latest(d).title)+'</div>':'<div class="meta">連載準備中</div>'))+'</div></div>'+
   '<div class="tags">'+w.tags.concat([w.status]).map(function(t){return'<span>'+esc(t)+'</span>'}).join('')+'</div>'+
   '<div class="acts"><button class="btn" data-go="#/w/'+w.id+'/'+(last||1)+'">'+(last?'繼續閱讀　第 '+last+' 集':'從第一集開始讀')+'</button>'+
   '<button class="btn ghost'+(fav?' on':'')+'" id="fav">'+(fav?'★ 已收藏':'☆ 收藏')+'</button></div>'+
   (rd?'<div class="prog"><i style="width:'+Math.round(rd/pubCount(d)*100)+'%"></i></div><div class="progt">已讀 '+rd+' / '+pubCount(d)+' 集</div>':'')+
   '<div class="tabs"><button data-t="intro">簡介</button><button data-t="eps">選集</button></div><div class="pane" id="pane"></div>';
  app.className='wrap hasnav';app.innerHTML=h+nav('');
  bindGo();startCarousel();
  document.getElementById('fav').onclick=function(){var f=favs(),i=f.indexOf(w.id);if(i<0)f.push(w.id);else f.splice(i,1);store.set('fav',f);toast(i<0?'已加入收藏':'已取消收藏');workPage(w)};
  app.querySelectorAll('.tabs button').forEach(function(b){b.onclick=function(){ui.tab=b.dataset.t;pane(w)}});
  pane(w);
}
function pane(w){
  var d=EPS[w.id];
  app.querySelectorAll('.tabs button').forEach(function(b){b.classList.toggle('on',b.dataset.t===ui.tab)});
  var p=document.getElementById('pane');
  if(ui.tab==='intro'){
    p.innerHTML='<div class="intro">'+w.intro.map(function(x){return'<p>'+esc(x)+'</p>'}).join('')+(w.poem?'<div class="poem">'+w.poem.map(esc).join('<br>')+'</div>':'')+'</div>';
  }else{
    p.innerHTML=epList(w,lastEp(w.id));
    bindList(w,p,function(){pane(w)});
  }
}
function epList(w,cur){
  var d=EPS[w.id],R=ranges(d.episodes.length),r=R[ui.range]||R[0],rs=readSet(w.id);
  var h='<div class="bar"><div class="ranges">'+R.map(function(x,i){return'<button data-r="'+i+'"'+(x===r?' class="on"':'')+'>'+x[0]+'-'+x[1]+'</button>'}).join('')+'</div>'+
   '<div class="mode"><button data-m="grid"'+(ui.mode==='grid'?' class="on"':'')+'>格子</button><button data-m="toc"'+(ui.mode==='toc'?' class="on"':'')+'>目錄</button></div></div>'+
   '<div class="eras">'+ERAS.map(function(x){return'<button data-era="'+x[0]+'"'+(x[0]===ui.era?' class="on"':'')+'>'+x[1]+'</button>'}).join('')+'</div>';
  var list=d.episodes.slice(r[0]-1,r[1]).filter(function(e){return ui.era==='all'||e.era===ui.era});
  function cls(e){return(e.status==='planned'?' plan':ready(e)?'':' wip')+(rs.indexOf(e.ep)>=0?' read':'')+(e.ep===cur?' cur':'')}
  function tag(e){return e.status==='planned'?'<em>規劃中</em>':e.status==='draft'?'<em class="dr">舊版待核</em>':ready(e)?'':'<em>撰寫中</em>'}
  if(!list.length)h+='<div class="empty">這個範圍沒有這一類的集數。</div>';
  else if(ui.mode==='grid'){
    h+='<div class="grid">'+list.map(function(e){return'<button class="cell'+cls(e)+'" data-ep="'+e.ep+'" title="'+esc(tt(e))+'">'+e.ep+'</button>'}).join('')+'</div>';
  }else{
    h+='<div class="toc">'+list.map(function(e){return'<button class="'+cls(e).trim()+'" data-ep="'+e.ep+'"><span>第'+e.ep+'集</span><b>'+esc(tt(e))+'</b>'+tag(e)+'</button>'}).join('')+'</div>';
  }
  h+='<div class="legend"><span><i style="background:var(--text)"></i>已上架</span><span><i style="background:var(--dim)"></i>撰寫中</span><span><i style="background:var(--sub)"></i>已讀 ✓</span><span><i style="background:var(--gold)"></i>上次讀到</span></div>';
  return h;
}
function bindList(w,p,redraw,onPick){
  p.querySelectorAll('[data-r]').forEach(function(b){b.onclick=function(){ui.range=+b.dataset.r;redraw()}});
  p.querySelectorAll('[data-era]').forEach(function(b){b.onclick=function(){ui.era=b.dataset.era;redraw()}});
  p.querySelectorAll('[data-m]').forEach(function(b){b.onclick=function(){ui.mode=b.dataset.m;store.set('mode',ui.mode);redraw()}});
  p.querySelectorAll('[data-ep]').forEach(function(b){b.onclick=function(){if(onPick)onPick();location.hash='#/w/'+w.id+'/'+b.dataset.ep}});
}

/* ---------- 閱讀頁 ---------- */
var FS=[17,19,21,24], THEMES=[['dark','夜'],['paper','紙'],['white','白']];
var onScroll=null;
function reader(w,n){
  var d=EPS[w.id];
  if(!(n>=1&&n<=d.episodes.length)){location.hash='#/w/'+w.id;return}
  var e=d.episodes[n-1], set=store.get('reader',{fs:1,theme:'dark'}), nx=d.episodes[n];
  store.set('last_'+w.id,n);touchRecent(w.id,n);
  app.className='wrap';
  var fab=!!(ready(e)&&e.audio&&w.audio);   // 有聲音檔的集數才出現「聽」
  app.innerHTML='<div class="reader '+set.theme+(fab?' hasfab':'')+'" style="--fs:'+FS[set.fs]+'px">'+
   '<div class="rtop"><button class="ic" data-go="#/w/'+w.id+'" aria-label="回作品頁">‹</button><div class="t">第 '+n+' 集　'+esc(tt(e))+'</div><button class="ic" id="aa" aria-label="閱讀設定" style="font-size:16px">Aa</button></div>'+
   '<div class="rbar"><i id="rbar"></i></div>'+
   (e.img?'<figure class="epimg"><img src="'+esc(wimg(w,e.img))+'" alt=""></figure>':'')+'<div class="rhead"><div class="sc">'+eraName(e)+'・第 '+n+' 集</div><h2>'+esc(tt(e))+'</h2><div class="orn">◆ ◆ ◆</div></div>'+(e.status==='draft'?'<div class="draftnote">舊版備份，尚未經作者核定，只在私人預覽檔出現，不會公開。</div>':'')+
   '<div id="body"></div>'+
   '<div class="endcard"><div class="e1">第 '+n+' 集　完</div><div class="e2">'+(nx?'下一集：'+esc(tt(nx)):'全書完')+'</div></div>'+
   '<div class="rnav"><button id="prev"'+(n>1?'':' disabled')+'>‹ 上一集</button><button id="list">選集</button><button id="next"'+(nx?'':' disabled')+'>下一集 ›</button></div>'+
   (fab?'<button class="ttsfab" id="ttsb" aria-label="聽這一集">'+IC.ear+'<span>聽</span></button>':'')+'</div>';   // 聽的按鈕放右下角，大拇指按得到
  window.scrollTo(0,0);
  bindGo();
  document.getElementById('prev').onclick=function(){location.hash='#/w/'+w.id+'/'+(n-1)};
  document.getElementById('next').onclick=function(){location.hash='#/w/'+w.id+'/'+(n+1)};
  document.getElementById('list').onclick=function(){listSheet(w,n)};
  document.getElementById('aa').onclick=function(){setSheet()};
  lsEnter(w,n,e,nx);
  var tb=document.getElementById('ttsb');
  if(tb)tb.onclick=function(){lsStart()};
  var body=document.getElementById('body'), key='pos_'+w.id+'_'+n, loaded=false;
  if(onScroll)window.removeEventListener('scroll',onScroll);
  onScroll=function(){
    var max=document.documentElement.scrollHeight-innerHeight, r=max>0?scrollY/max:1;
    var bar=document.getElementById('rbar');if(bar)bar.style.width=Math.round(r*100)+'%';
    if(!loaded)return;          // 正文還沒排好之前的捲動不算數，免得把上次的位置蓋掉
    store.set(key,r); if(r>0.92)markRead(w.id,n);
  };
  window.addEventListener('scroll',onScroll,{passive:true});
  if(!ready(e)){body.innerHTML='<div class="empty"><div class="big">✎</div>'+(e.status==='planned'?'這一集還在規劃中。':'這一集還在撰寫中。<br>上架之後會直接出現在這裡。')+'</div>';return}
  body.innerHTML='<div class="empty">載入中…</div>';
  getText(wbase(w)+'chapters/'+e.file).then(function(t){
    body.className='body';body.innerHTML=md(t,wbase(w)+'chapters/');
    body.querySelectorAll('.gal').forEach(gal);
    setTimeout(vpSize,0);
    (e.pics||[]).forEach(function(pc){   // 正文插圖：放在含有指定文字的那一段後面（插圖另外存，正文從 Drive 更新也不會被蓋掉）
      var ps=body.querySelectorAll('p');for(var i=0;i<ps.length;i++){if(ps[i].textContent.indexOf(pc.after)>=0){
        var f=document.createElement('figure');f.className='pic';f.innerHTML='<img src="'+esc(wimg(w,pc.img))+'" alt="" loading="lazy">'+(pc.poem?'<div class="vp'+(pc.dark?' dk':'')+(pc.bg?' bg':'')+'" style="'+(pc.side==='left'?'left':'right')+':'+(pc.x||4)+'%;top:'+(pc.y||7)+'%">'+pc.poem.map(function(l){return'<span>'+esc(l)+'</span>'}).join('')+'</div>':'');   // 題畫詩：網站疊字，圖本身無字
        ps[i].parentNode.insertBefore(f,ps[i].nextSibling);var im=f.querySelector('img');im.onload=vpSize;break}}
    });
    var r=store.get(key,0);   // 回到上次讀到的位置
    setTimeout(function(){
      if(r>0.02&&r<0.95)scrollTo(0,r*(document.documentElement.scrollHeight-innerHeight));
      setTimeout(function(){loaded=true;onScroll()},120);
      lsBind();   // 正文排好了，把時間表對到段落上
    },50);
  }).catch(function(){body.innerHTML='<div class="empty">正文讀取失敗，請重新整理。</div>'});
}
/* 正文格式：空一行＝分段；單獨一行 ---、***、＊＊＊ ＝場景轉換；**字**＝粗體；![說明](檔名) ＝插圖 */
function md(t,base){
  return t.replace(/^﻿/,'').replace(/\r/g,'').split(/\n\s*\n/).map(function(b){
    b=b.trim(); if(!b)return'';
    if(/^([-－—*＊]\s*){3,}$/.test(b))return'<div class="brk">◇　◇　◇</div>';   // --- *** ＊＊＊ 都當場景轉換
    var ls=b.split('\n'),IMG=/^!\[([^\]]*)\]\(([^)\s]+)\)$/;
    if(ls.length>1&&ls.every(function(l){return IMG.test(l.trim())})){   // 連續幾行圖片 = 左右滑動的圖集
      return'<div class="gal"><div class="gtr">'+ls.map(function(l){var m=l.trim().match(IMG);
        return'<figure><img src="'+esc(src(base+m[2]))+'" alt="'+esc(m[1])+'" loading="lazy">'+(m[1]?'<figcaption>'+esc(m[1])+'</figcaption>':'')+'</figure>'}).join('')+
        '</div>'+(ls.length>12?'<div class="gcnt"><b>1</b> / '+ls.length+'</div>':'<div class="gdots">'+ls.map(function(){return'<i></i>'}).join('')+'</div>')+'</div>';   // 頁數多就改顯示頁碼
    }
    var im=b.match(IMG);
    if(im)return'<figure><img src="'+esc(src(base+im[2]))+'" alt="'+esc(im[1])+'" loading="lazy">'+(im[1]?'<figcaption>'+esc(im[1])+'</figcaption>':'')+'</figure>';
    return'<p>'+esc(b).replace(/\*\*([^*\n]+)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>')+'</p>';   // **字** 顯示成粗體，不露出星號
  }).join('');
}
function vpSize(){   // 題畫詩字級：圖片寬度的 4.2%，但最長那一句一定要在圖片高度內排成一直行（不用 cqw，舊版手機瀏覽器不支援）
  document.querySelectorAll('.pic').forEach(function(f){var v=f.querySelector('.vp');if(!v)return;
    var n=0;v.querySelectorAll('span').forEach(function(s){n=Math.max(n,s.textContent.length)});
    var top=parseFloat(v.style.top)||7,room=f.clientHeight*(1-top/100-0.06),pad=v.classList.contains('bg')?1.2:0;
    v.style.fontSize=Math.min(f.clientWidth*0.042,room/(n*1.24+pad)).toFixed(1)+'px'})
}
window.addEventListener('resize',vpSize);
function gal(g){   // 圖集：滑動時更新下方圓點
  var tr=g.querySelector('.gtr'),ds=g.querySelectorAll('.gdots i'),cn=g.querySelector('.gcnt b');
  function u(){var k=Math.round(tr.scrollLeft/tr.clientWidth);ds.forEach(function(d,i){d.classList.toggle('on',i===k)});if(cn)cn.textContent=k+1}
  tr.addEventListener('scroll',u,{passive:true});u();
}
function sheet(html,bind){
  var m=document.createElement('div');m.className='mask';
  var s=document.createElement('div');s.className='sheet';s.innerHTML='<div class="grab"></div>'+html;
  function close(){m.remove();s.remove()}
  m.onclick=close;document.body.appendChild(m);document.body.appendChild(s);bind(s,close);
}
function listSheet(w,n){
  ui.range=rangeOf(n);if(ui.mode===null)ui.mode=store.get('mode','grid');
  sheet('<h3>'+esc(w.title)+'－'+esc(w.subtitle)+'</h3><div id="sl"></div>',function(s,close){
    var box=s.querySelector('#sl');
    function draw(){box.innerHTML=epList(w,n);bindList(w,box,draw,close)}
    draw();
  });
}
function setSheet(){
  var set=store.get('reader',{fs:1,theme:'dark'});
  sheet('<h3>閱讀設定</h3>'+
   '<div class="opt">字級<div class="seg">'+FS.map(function(f,i){return'<button data-fs="'+i+'" style="font-size:'+(12+i*2)+'px">A</button>'}).join('')+'</div></div>'+
   '<div class="opt">底色<div class="seg">'+THEMES.map(function(t){return'<button data-th="'+t[0]+'">'+t[1]+'</button>'}).join('')+'</div></div>',
  function(s){
    var r=app.querySelector('.reader');
    function apply(){store.set('reader',set);if(r){r.className='reader '+set.theme;r.style.setProperty('--fs',FS[set.fs]+'px')}
      s.querySelectorAll('[data-fs]').forEach(function(b){b.classList.toggle('on',+b.dataset.fs===set.fs)});
      s.querySelectorAll('[data-th]').forEach(function(b){b.classList.toggle('on',b.dataset.th===set.theme)})}
    s.querySelectorAll('[data-fs]').forEach(function(b){b.onclick=function(){set.fs=+b.dataset.fs;apply()}});
    s.querySelectorAll('[data-th]').forEach(function(b){b.onclick=function(){set.theme=b.dataset.th;apply()}});
    apply();
  });
}

/* ---------- 聽小說：播放事先做好的聲音檔（每集一個 mp3 ＋ 一份段落時間表） ----------
   works.json 的 audio＝聲音檔的網址開頭；episodes.json 某集有 audio（例如 "EP001"）才會出現「聽」。
   時間表 EP001.json：{"dur":秒數,"seg":[{"t":0,"k":"h"},{"t":3.2,"k":0,"x":"段落開頭幾個字"},…,{"t":秒,"k":"e"}]}
   k：h＝標題、數字＝正文第幾段（從 0 算）、e＝集末；x 用來確認段落沒有對錯（正文改過也找得回來） */
var RATES=[0.8,1,1.2,1.5];
var ls={au:null,ctx:null,tm:null,tmFor:'',seg:[],el:null,next:false,seek:null,touch:0};
var IC={play:'<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',pause:'<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
  prev:'<svg viewBox="0 0 24 24"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></svg>',next:'<svg viewBox="0 0 24 24"><path d="M16 5h2v14h-2zM4 5v14l11-7z"/></svg>',
  ear:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/></svg>'};
function lsUrl(w,e,ext){return new URL(w.audio+e.audio+ext,location.href).href}
function lsTime(t){t=Math.max(0,Math.floor(t||0));return Math.floor(t/60)+':'+('0'+t%60).slice(-2)}
function lsAudio(){
  if(ls.au)return ls.au;
  var a=ls.au=new Audio();a.preload='metadata';
  a.addEventListener('timeupdate',lsSync);
  a.addEventListener('loadedmetadata',function(){if(ls.seek!=null){try{a.currentTime=ls.seek}catch(e){}ls.seek=null}lsUI()});
  a.addEventListener('play',lsUI);a.addEventListener('pause',lsUI);
  a.addEventListener('waiting',function(){var t=document.getElementById('lstm');if(t)t.textContent='緩衝中…'});
  a.addEventListener('ended',lsDone);
  a.addEventListener('error',function(){if(!a.getAttribute('src'))return;toast('聲音檔讀取失敗，請稍後再試');lsUI()});
  if('mediaSession' in navigator){   // 鎖屏畫面的播放鍵
    var M=navigator.mediaSession;
    try{
      M.setActionHandler('play',function(){a.play()});M.setActionHandler('pause',function(){a.pause()});
      M.setActionHandler('seekbackward',function(){a.currentTime=Math.max(0,a.currentTime-15)});
      M.setActionHandler('seekforward',function(){a.currentTime=Math.min(a.duration||0,a.currentTime+15)});
      M.setActionHandler('nexttrack',function(){lsNextEp()});
    }catch(e){}
  }
  ['touchstart','wheel'].forEach(function(k){window.addEventListener(k,function(){ls.touch=Date.now()},{passive:true})});   // 使用者自己在捲，就先不自動捲
  return a;
}
function lsEnter(w,n,e,nx){   // 進到一集：先把時間表抓下來，按「聽」的當下才能馬上播（iPhone 要在按的那一刻開始播放）
  ls.ctx={w:w,n:n,e:e,nx:nx};ls.seg=[];ls.el=null;
  if(!(ready(e)&&e.audio&&w.audio)){ls.tm=null;ls.tmFor='';return}
  var u=lsUrl(w,e,'.json');
  if(ls.tmFor===u)return;
  ls.tm=null;ls.tmFor=u;
  fetch(u,{cache:'no-cache'}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(j){if(ls.tmFor===u){ls.tm=j;lsBind()}}).catch(function(){});
}
function lsBind(){   // 時間表的每一格對到畫面上的段落
  var r=app.querySelector('.reader');if(!r||!ls.tm||!ls.tm.seg)return;
  var ps=[].slice.call(r.querySelectorAll('#body p'));if(!ps.length)return;
  var h=r.querySelector('.rhead h2'),end=r.querySelector('.endcard'),from=0;
  ls.seg=ls.tm.seg.map(function(g){
    var el=null;
    if(g.k==='h')el=h;else if(g.k==='e')el=end;
    else{
      var p=ps[g.k];
      if(p&&(!g.x||p.textContent.trim().indexOf(g.x)===0))el=p;
      else if(g.x){for(var i=from;i<ps.length;i++)if(ps[i].textContent.trim().indexOf(g.x)===0){el=ps[i];break}}
      if(el)from=ps.indexOf(el)+1;
    }
    return{t:g.t,el:el};
  });
  if(document.getElementById('ttsbar'))lsSync();
}
function lsAt(t){var a=0,b=ls.seg.length-1,k=-1;while(a<=b){var m=(a+b)>>1;if(ls.seg[m].t<=t+0.05){k=m;a=m+1}else b=m-1}return k}
function lsMark(el){   // 標亮正在唸的段落；快超出畫面就捲過去（使用者剛自己捲過就不搶）
  if(ls.el===el)return;
  if(ls.el)ls.el.classList.remove('tts');
  ls.el=el;if(!el)return;
  el.classList.add('tts');
  if(Date.now()-ls.touch<4000)return;
  var b=el.getBoundingClientRect(),bar=document.getElementById('ttsbar'),bh=bar?bar.offsetHeight:0;
  if(b.top<60||b.bottom>innerHeight-bh-16)scrollTo({top:scrollY+b.top-innerHeight*0.28,behavior:'smooth'});
}
function lsSync(){
  var a=ls.au;if(!a)return;
  var k=lsAt(a.currentTime);lsMark(k>=0?ls.seg[k].el:null);
  var sl=document.getElementById('lssl'),tm=document.getElementById('lstm'),d=a.duration||(ls.tm&&ls.tm.dur)||0;
  if(sl&&!sl.dragging){sl.max=d||1;sl.value=a.currentTime}
  if(tm)tm.textContent=lsTime(a.currentTime)+' / '+lsTime(d);
}
function lsStart(){   // 按「聽」：從畫面上正在看的那一段開始
  var c=ls.ctx;if(!c||!c.e.audio)return;
  var a=lsAudio(),src=lsUrl(c.w,c.e,'.mp3'),t=0;
  if(scrollY>150&&ls.seg.length){for(var i=0;i<ls.seg.length;i++){var el=ls.seg[i].el;if(el&&el.getBoundingClientRect().bottom>70){t=ls.seg[i].t;break}}}
  if(a.getAttribute('src')!==src){a.src=src;ls.seek=t}else{try{a.currentTime=t}catch(e){ls.seek=t}}
  a.playbackRate=RATES[store.get('tts_rate',1)]||1;
  lsMeta();lsUI();
  var p=a.play();if(p&&p.catch)p.catch(function(){lsUI()});
}
function lsMeta(){
  var c=ls.ctx;if(!c||!('mediaSession' in navigator)||!window.MediaMetadata)return;
  try{navigator.mediaSession.metadata=new MediaMetadata({title:'第 '+c.n+' 集　'+tt(c.e),artist:c.w.title+'－'+c.w.subtitle,album:c.w.title,
    artwork:[{src:new URL(wimg(c.w,c.w.cover),location.href).href,sizes:'600x800',type:'image/jpeg'}]})}catch(e){}
}
function lsJump(d){   // 上一段／下一段
  var a=ls.au;if(!a||!ls.seg.length)return;
  var k=lsAt(a.currentTime);
  if(d>0)k=Math.min(ls.seg.length-1,k+1);
  else if(k>=0&&a.currentTime-ls.seg[k].t<2)k=Math.max(0,k-1);
  a.currentTime=ls.seg[Math.max(0,k)].t;lsSync();
}
function lsNextEp(){
  var c=ls.ctx,nx=c&&c.nx;
  if(!(nx&&ready(nx)&&nx.audio)){ls.au.pause();toast(nx?'這一集聽完了':'全書聽完了');return false}
  var a=ls.au;a.src=lsUrl(c.w,nx,'.mp3');ls.seek=0;   // 同一個播放器直接換下一集，鎖著螢幕也能接下去
  a.playbackRate=RATES[store.get('tts_rate',1)]||1;
  var p=a.play();if(p&&p.catch)p.catch(function(){});
  ls.next=true;toast('接著聽第 '+(c.n+1)+' 集');location.hash='#/w/'+c.w.id+'/'+(c.n+1);
  setTimeout(lsMeta,300);
  return true;
}
function lsDone(){if(store.get('tts_auto',true))lsNextEp();else{toast('這一集聽完了');lsUI()}}
function lsStop(){
  if(ls.au){ls.au.pause();ls.au.removeAttribute('src');ls.au.load()}
  var b=document.getElementById('ttsbar');if(b)b.remove();document.body.classList.remove('ttson');
  if(ls.el)ls.el.classList.remove('tts');ls.el=null;
}
function lsUI(){
  var a=ls.au;if(!a||!a.getAttribute('src'))return;
  var b=document.getElementById('ttsbar');
  if(!b){
    b=document.createElement('div');b.id='ttsbar';b.className='ttsbar';
    b.innerHTML='<div class="lsrow"><input type="range" id="lssl" min="0" max="1" step="0.1" value="0" aria-label="播放進度"><span id="lstm">0:00</span></div>'+
      '<div class="lsbtn"><button data-t="prev" aria-label="上一段">'+IC.prev+'</button><button data-t="play" class="pp"></button><button data-t="next" aria-label="下一段">'+IC.next+'</button>'+
      '<button data-t="rate" class="tx" aria-label="語速"></button><button data-t="set" class="tx">設定</button><button data-t="close" class="tx" aria-label="關閉">✕</button></div>';
    b.onclick=function(ev){
      var k=ev.target.closest('[data-t]');if(!k)return;k=k.dataset.t;
      if(k==='play'){if(a.paused)a.play();else a.pause()}
      else if(k==='prev')lsJump(-1);
      else if(k==='next')lsJump(1);
      else if(k==='rate'){store.set('tts_rate',(store.get('tts_rate',1)+1)%RATES.length);a.playbackRate=RATES[store.get('tts_rate',1)];lsUI()}
      else if(k==='set')lsSheet();
      else if(k==='close')lsStop();
    };
    var sl=b.querySelector('#lssl');
    sl.addEventListener('input',function(){sl.dragging=true;a.currentTime=+sl.value;lsSync()});
    sl.addEventListener('change',function(){sl.dragging=false});
    document.body.appendChild(b);document.body.classList.add('ttson');
  }
  var p=b.querySelector('.pp');p.innerHTML=a.paused?IC.play:IC.pause;p.setAttribute('aria-label',a.paused?'播放':'暫停');
  b.querySelector('[data-t=rate]').textContent=RATES[store.get('tts_rate',1)]+'×';
  lsSync();
}
function lsSheet(){
  sheet('<h3>聽小說設定</h3><div class="opt">聽完自動接下一集<div class="seg"><button data-a="1">開</button><button data-a="0">關</button></div></div>',
  function(s){
    function draw(){var v=store.get('tts_auto',true);s.querySelectorAll('[data-a]').forEach(function(b){b.classList.toggle('on',(b.dataset.a==='1')===v)})}
    s.querySelectorAll('[data-a]').forEach(function(b){b.onclick=function(){store.set('tts_auto',b.dataset.a==='1');draw()}});
    draw();
  });
}

/* ---------- 收藏 ---------- */
function favPage(){
  Promise.all(WORKS.map(loadEps)).then(function(){
    var f=favs().map(work).filter(Boolean);
    var h='<div class="pagett">我的收藏</div>'+(f.length?'<div class="shelf">'+f.map(bookCard).join('')+'</div>':
      '<div class="empty"><div class="big">☆</div>還沒有收藏的作品。<br>在作品頁按「收藏」就會出現在這裡。</div>');
    app.className='wrap hasnav';app.innerHTML=h+nav('fav');
  }).catch(fail);
}

/* ---------- 敬請期待：籌備中的作品先給朋友看 ---------- */
var SOON=[['168 台股投資教室・Q人的練功之路',['soon/168_home.jpg']],['168 可轉債研究室',['soon/168_cb.jpg']],['168 台股投資練功房',['soon/168_stock.jpg']],
  ['表情貼圖',['soon/mascot1.jpg','soon/mascot2.jpg','soon/mascot3.jpg','soon/mascot4.jpg']]];
function soonPage(){
  app.className='wrap';
  app.innerHTML='<div class="top"><button class="ic" data-go="#/" aria-label="回首頁" style="color:var(--text)">‹</button><h1>敬請期待</h1><span style="width:40px"></span></div>'+
    '<div class="soonp">'+SOON.map(function(g){return'<h3>'+esc(g[0])+'</h3>'+g[1].map(function(f){return'<img src="'+f+'" alt="" loading="lazy">'}).join('')}).join('')+
    '<div class="soonend">籌備中，敬請期待</div></div>';
  window.scrollTo(0,0);bindGo();
}

/* ---------- 我的 ---------- */
function mePage(){
  Promise.all(WORKS.map(loadEps)).then(function(){
    var rec=store.get('recent',[]).filter(function(x){return work(x.id)});
    var h='<div class="pagett">我的</div><div class="group">閱讀紀錄</div><div class="list">'+
     (rec.length?rec.map(function(x){var w=work(x.id),e=EPS[w.id].episodes[x.ep-1],d=new Date(x.t);
       return'<a href="#/w/'+w.id+'/'+x.ep+'"><img src="'+wimg(w,w.cover)+'" alt=""><div class="t">'+esc(w.title)+'－'+esc(w.subtitle)+
         '<small>第 '+x.ep+' 集・'+esc(e?tt(e):'')+'・'+(d.getMonth()+1)+'/'+d.getDate()+'</small></div><span class="arr">›</span></a>'}).join('')
      :'<div class="empty">還沒有閱讀紀錄。</div>')+'</div>'+
     '<div class="group">設定</div><div class="list"><button id="rs">閱讀設定（字級、底色）<span class="arr" style="margin-left:auto">›</span></button>'+
     '<button id="clr" class="danger">清除這台裝置上的閱讀紀錄</button></div>'+
     '<div class="group">關於</div><div class="list"><a><div class="t">'+esc(SITE.name)+'<small>閱讀紀錄與收藏只存在你這台裝置的瀏覽器裡，不會上傳。</small></div></a></div>';
    app.className='wrap hasnav';app.innerHTML=h+nav('me');
    document.getElementById('rs').onclick=function(){setSheet()};
    document.getElementById('clr').onclick=function(){
      if(!confirm('確定清除閱讀紀錄、進度與收藏？'))return;
      try{Object.keys(localStorage).forEach(function(k){if(k.indexOf('dl_')===0&&k!=='dl_reader'&&k!=='dl_mode')localStorage.removeItem(k)})}catch(e){}
      toast('已清除');mePage()};
  }).catch(fail);
}

/* ---------- 啟動 ---------- */
window.addEventListener('hashchange',function(){if(SITE)route()});
getJSON('data/works.json').then(function(j){SITE=j.site;WORKS=j.works;route()}).catch(fail);
if('serviceWorker' in navigator&&!PRE&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(function(){});
})();
