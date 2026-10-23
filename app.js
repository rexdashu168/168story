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
// #/  #/fav  #/me  #/w/作品  #/w/作品/集數
function route(){
  clearInterval(timer);
  var go=tts.next;tts.next=false;tts.go=go;if(!go)ttsStop();   // 聽完一集自動接下一集時，播放列留著
  document.querySelectorAll('.mask,.sheet').forEach(function(x){x.remove()});
  if(onScroll){window.removeEventListener('scroll',onScroll);onScroll=null}   // 離開閱讀頁就不再記位置
  var h=location.hash.replace(/^#\/?/,'').split('/');
  if(h[0]==='w'&&work(h[1])){var w=work(h[1]);return loadEps(w).then(function(){h[2]?reader(w,+h[2]):workPage(w)}).catch(fail)}
  if(h[0]==='fav')return favPage();
  if(h[0]==='me')return mePage();
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
       '<div class="book soon"><div class="pic">敬請期待</div><b>下一部作品</b><small>籌備中</small></div></div>';
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
  app.innerHTML='<div class="reader '+set.theme+'" style="--fs:'+FS[set.fs]+'px">'+
   '<div class="rtop"><button class="ic" data-go="#/w/'+w.id+'" aria-label="回作品頁">‹</button><div class="t">第 '+n+' 集　'+esc(tt(e))+'</div>'+(TTS&&ready(e)?'<button class="ic" id="ttsb" aria-label="聽這一集">'+IC.ear+'</button>':'')+'<button class="ic" id="aa" aria-label="閱讀設定" style="font-size:16px">Aa</button></div>'+
   '<div class="rbar"><i id="rbar"></i></div>'+
   (e.img?'<figure class="epimg"><img src="'+esc(wimg(w,e.img))+'" alt=""></figure>':'')+'<div class="rhead"><div class="sc">'+eraName(e)+'・第 '+n+' 集</div><h2>'+esc(tt(e))+'</h2><div class="orn">◆ ◆ ◆</div></div>'+(e.status==='draft'?'<div class="draftnote">舊版備份，尚未經作者核定，只在私人預覽檔出現，不會公開。</div>':'')+
   '<div id="body"></div>'+
   '<div class="endcard"><div class="e1">第 '+n+' 集　完</div><div class="e2">'+(nx?'下一集：'+esc(tt(nx)):'全書完')+'</div></div>'+
   '<div class="rnav"><button id="prev"'+(n>1?'':' disabled')+'>‹ 上一集</button><button id="list">選集</button><button id="next"'+(nx?'':' disabled')+'>下一集 ›</button></div></div>';
  window.scrollTo(0,0);
  bindGo();
  document.getElementById('prev').onclick=function(){location.hash='#/w/'+w.id+'/'+(n-1)};
  document.getElementById('next').onclick=function(){location.hash='#/w/'+w.id+'/'+(n+1)};
  document.getElementById('list').onclick=function(){listSheet(w,n)};
  document.getElementById('aa').onclick=function(){setSheet()};
  tts.ctx={w:w,n:n,nx:nx};tts.list=[];tts.i=0;
  var tb=document.getElementById('ttsb');
  if(tb)tb.onclick=function(){
    if(tts.on){ttsPause();return}
    if(!tts.list.length){if(!ttsBuild()){toast('正文還在載入');return}tts.i=ttsFrom()}
    ttsPlay();
  };
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
      if(tts.go){tts.go=false;if(ttsBuild())ttsPlay();else ttsStop()}   // 上一集聽完，接著唸這一集
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

/* ---------- 聽小說：用手機內建的語音朗讀，不另做聲音檔 ---------- */
var TTS=('speechSynthesis' in window&&'SpeechSynthesisUtterance' in window)?window.speechSynthesis:null;
var RATES=[0.8,1,1.2,1.5];
var tts={on:false,list:[],i:0,gen:0,u:null,el:null,next:false,go:false,lock:null,ctx:null,err:0};
var IC={play:'<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',pause:'<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
  prev:'<svg viewBox="0 0 24 24"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></svg>',next:'<svg viewBox="0 0 24 24"><path d="M16 5h2v14h-2zM4 5v14l11-7z"/></svg>',
  ear:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/></svg>'};
if(TTS)TTS.getVoices();   // 有些瀏覽器要先問一次，聲音清單才會開始載入
function ttsVoices(){   // 台灣中文優先，同語言再挑高品質；粵語不列
  if(!TTS)return[];
  function sc(v){var l=(v.lang||'').replace('_','-').toLowerCase(),nm=v.name||'',s;
    if(l==='zh-tw'||/臺灣|台灣|taiwan/i.test(nm))s=300;else if(l.indexOf('zh-hant')===0)s=250;else if(l==='zh-hk'||l.indexOf('yue')===0)return 0;else if(l.indexOf('zh')===0||l.indexOf('cmn')===0)s=100;else return 0;
    if(/natural|neural/i.test(nm))s+=40;else if(/premium|enhanced|增強|高音質/i.test(nm))s+=30;else if(/online/i.test(nm))s+=20;
    return s}
  return TTS.getVoices().map(function(v){return{v:v,s:sc(v)}}).filter(function(x){return x.s>0}).sort(function(a,b){return b.s-a.s}).map(function(x){return x.v});
}
function ttsVoice(){var vs=ttsVoices(),nm=store.get('tts_voice','');for(var i=0;i<vs.length;i++)if(vs[i].name===nm)return vs[i];return vs[0]||null}
function ttsSplit(t){   // 一句一句唸；太長的句子在逗號切開（有些瀏覽器一次唸太長會中斷）
  var out=[],b='',E='。！？!?…',Q='」』）)';
  for(var i=0;i<t.length;i++){var c=t[i],nx=t[i+1]||'';b+=c;
    if((E.indexOf(c)>=0&&E.indexOf(nx)<0&&Q.indexOf(nx)<0)||(Q.indexOf(c)>=0&&E.indexOf(t[i-1]||'')>=0)||(b.length>80&&'，、；：'.indexOf(c)>=0)){if(b.trim())out.push(b.trim());b=''}}
  if(b.trim())out.push(b.trim());
  return out;
}
function ttsBuild(){
  var r=app.querySelector('.reader'),c=tts.ctx;if(!r||!c)return false;
  var h=r.querySelector('.rhead h2'),ps=r.querySelectorAll('#body p'),end=r.querySelector('.endcard .e1');
  tts.list=[];tts.i=0;
  if(!ps.length)return false;
  if(h)tts.list.push({el:h,t:'第'+zh(c.n)+'集。'+h.textContent});
  ps.forEach(function(p){ttsSplit(p.textContent).forEach(function(s){tts.list.push({el:p,t:s})})});
  if(end)tts.list.push({el:end,t:'第'+zh(c.n)+'集，完。'});
  return true;
}
function ttsFrom(){   // 從畫面上正在看的那一段開始唸
  if(scrollY<150)return 0;
  for(var i=0;i<tts.list.length;i++){if(tts.list[i].el.getBoundingClientRect().bottom>70)return i}
  return 0;
}
function ttsMark(el){   // 標亮正在唸的段落，快超出畫面就捲過去
  if(tts.el===el)return;
  if(tts.el)tts.el.classList.remove('tts');
  tts.el=el;el.classList.add('tts');
  var b=el.getBoundingClientRect(),bar=document.getElementById('ttsbar'),bh=bar?bar.offsetHeight:0;
  if(b.top<60||b.bottom>innerHeight-bh-16)scrollTo({top:scrollY+b.top-innerHeight*0.28,behavior:'smooth'});
}
function ttsSay(){
  var g=++tts.gen,c=tts.list[tts.i];
  if(!c)return ttsDone();
  ttsMark(c.el);
  var u=new SpeechSynthesisUtterance(c.t),v=ttsVoice();
  u.lang=v?v.lang:'zh-TW';if(v)u.voice=v;
  u.rate=RATES[store.get('tts_rate',1)]||1;
  u.onstart=function(){tts.err=0};
  u.onend=function(){if(g!==tts.gen||!tts.on)return;tts.i++;ttsSay()};
  u.onerror=function(ev){
    if(g!==tts.gen||!tts.on)return;
    if(ev.error==='not-allowed'){ttsPause();toast('請按播放鍵開始朗讀');return}
    if(ev.error==='interrupted'||ev.error==='canceled')return;
    if(++tts.err>3){ttsPause();toast('這台裝置的朗讀暫時無法使用');return}
    tts.i++;ttsSay();
  };
  tts.u=u;   // 留住這一句，免得被回收後收不到「唸完了」
  TTS.speak(u);
}
function ttsPlay(){
  if(!TTS||!tts.list.length)return;
  if(tts.i>=tts.list.length)tts.i=0;
  tts.on=true;tts.err=0;
  if(TTS.speaking||TTS.pending)TTS.cancel();
  if(TTS.paused)TTS.resume();
  ttsSay();ttsWake(true);ttsUI();
}
function ttsPause(){if(!TTS)return;tts.on=false;tts.gen++;TTS.cancel();ttsWake(false);ttsUI()}
function ttsStop(){
  if(!TTS)return;
  var b=document.getElementById('ttsbar');
  if(tts.on||TTS.speaking){tts.on=false;tts.gen++;TTS.cancel()}
  ttsWake(false);
  if(b)b.remove();document.body.classList.remove('ttson');
  if(tts.el)tts.el.classList.remove('tts');tts.el=null;tts.list=[];tts.i=0;
  var hb=document.getElementById('ttsb');if(hb)hb.classList.remove('on');
}
function ttsJump(d){   // 上一段／下一段，以段落為單位
  if(!tts.list.length)return;
  var i=tts.i,el=tts.list[i]&&tts.list[i].el;
  if(d>0){while(i<tts.list.length&&tts.list[i].el===el)i++;if(i>=tts.list.length)i=tts.list.length-1}
  else{var s=i;while(s>0&&tts.list[s-1].el===el)s--;   // 先回本段開頭，已在開頭才到上一段
    if(s===i&&s>0){var pe=tts.list[s-1].el;s--;while(s>0&&tts.list[s-1].el===pe)s--}
    i=s}
  tts.i=i;
  if(tts.on){TTS.cancel();ttsSay()}else ttsMark(tts.list[i].el);
}
function ttsDone(){
  var c=tts.ctx,nx=c&&c.nx;
  if(nx&&ready(nx)&&store.get('tts_auto',true)){
    tts.next=true;tts.on=false;tts.gen++;toast('接著聽第 '+(c.n+1)+' 集');
    location.hash='#/w/'+c.w.id+'/'+(c.n+1);return;
  }
  ttsPause();tts.i=0;toast(nx?'這一集聽完了':'全書聽完了');
}
function ttsWake(on){   // 朗讀時不讓螢幕自動關掉（iPhone 鎖螢幕後朗讀會停）
  try{
    if(on&&navigator.wakeLock&&!tts.lock)navigator.wakeLock.request('screen').then(function(l){tts.lock=l;l.addEventListener('release',function(){tts.lock=null})}).catch(function(){});
    else if(!on&&tts.lock){tts.lock.release();tts.lock=null}
  }catch(e){}
}
document.addEventListener('visibilitychange',function(){   // 切回來時，如果系統把朗讀停掉了，就從這一句重新唸
  if(document.hidden||!tts.on||!TTS)return;
  ttsWake(true);
  setTimeout(function(){if(tts.on&&!TTS.speaking){TTS.cancel();ttsSay()}},300);
});
function ttsUI(){
  var b=document.getElementById('ttsbar');
  if(!b){
    b=document.createElement('div');b.id='ttsbar';b.className='ttsbar';
    b.innerHTML='<button data-t="prev" aria-label="上一段">'+IC.prev+'</button><button data-t="play" class="pp"></button><button data-t="next" aria-label="下一段">'+IC.next+'</button>'+
      '<button data-t="rate" class="tx" aria-label="語速"></button><button data-t="set" class="tx">聲音</button><button data-t="close" class="tx" aria-label="關閉朗讀">✕</button>';
    b.onclick=function(ev){
      var k=ev.target.closest('[data-t]');if(!k)return;k=k.dataset.t;
      if(k==='play'){if(tts.on)ttsPause();else ttsPlay()}
      else if(k==='prev')ttsJump(-1);
      else if(k==='next')ttsJump(1);
      else if(k==='rate'){store.set('tts_rate',(store.get('tts_rate',1)+1)%RATES.length);ttsUI();if(tts.on){TTS.cancel();ttsSay()}}
      else if(k==='set')ttsSheet();
      else if(k==='close')ttsStop();
    };
    document.body.appendChild(b);document.body.classList.add('ttson');
  }
  var p=b.querySelector('.pp');p.innerHTML=tts.on?IC.pause:IC.play;p.setAttribute('aria-label',tts.on?'暫停':'播放');
  b.querySelector('[data-t=rate]').textContent=RATES[store.get('tts_rate',1)]+'×';
  var hb=document.getElementById('ttsb');if(hb)hb.classList.toggle('on',tts.on);
}
function ttsSheet(){
  var vs=ttsVoices();
  sheet('<h3>朗讀設定</h3>'+
   '<div class="opt">讀完自動接下一集<div class="seg"><button data-a="1">開</button><button data-a="0">關</button></div></div>'+
   '<div class="vh">聲音（點一下就從目前這段試聽）</div>'+
   (vs.length?'<div class="vlist">'+vs.map(function(v,i){return'<button data-v="'+i+'">'+esc(v.name)+'<small>'+esc(v.lang)+'</small></button>'}).join('')+'</div>'
     :'<div class="vnote">這台裝置找不到中文語音。</div>')+
   '<div class="vnote">聲音由這台手機或電腦提供，每台裝置不一樣。iPhone 可以到「設定」的「輔助使用」→「朗讀內容」→「聲音」，下載中文（台灣）的增強版聲音，音質會比較好。</div>',
  function(s){
    function draw(){
      var a=store.get('tts_auto',true),c=ttsVoice();
      s.querySelectorAll('[data-a]').forEach(function(b){b.classList.toggle('on',(b.dataset.a==='1')===a)});
      s.querySelectorAll('[data-v]').forEach(function(b){b.classList.toggle('on',!!c&&vs[+b.dataset.v].name===c.name)});
    }
    s.querySelectorAll('[data-a]').forEach(function(b){b.onclick=function(){store.set('tts_auto',b.dataset.a==='1');draw()}});
    s.querySelectorAll('[data-v]').forEach(function(b){b.onclick=function(){store.set('tts_voice',vs[+b.dataset.v].name);draw();if(tts.on){TTS.cancel();ttsSay()}else ttsPlay()}});
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
