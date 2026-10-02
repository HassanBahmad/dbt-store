(function(){
  var KEY='dbt_cart';
  function load(){ try{ return JSON.parse(localStorage.getItem(KEY)||'[]'); }catch(e){ return []; } }
  function save(c){ try{ localStorage.setItem(KEY,JSON.stringify(c)); }catch(e){} badge(); }
  function fmt(v){ var s=(Math.round(v*100)/100).toFixed(2).replace('.',','); s=s.replace(/\B(?=(\d{3})+(?!\d))/g,' '); return s.replace(/,00$/,''); }
  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function badge(){
    var c=load(), n=c.reduce(function(a,i){return a+i.qty;},0), t=c.reduce(function(a,i){return a+i.qty*(i.price||0);},0);
    document.querySelectorAll('.cart-count').forEach(function(b){ b.textContent=n; b.hidden=!n; });
    document.querySelectorAll('.cart-sum').forEach(function(b){ b.textContent=n?(t?fmt(t)+' DH':n+' article'+(n>1?'s':'')):'0 DH'; });
  }
  function item(el){ return {id:el.dataset.id, sku:el.dataset.sku, name:el.dataset.name, price:parseFloat(el.dataset.price)||0, url:el.dataset.url, img:el.dataset.img, univ:el.dataset.univ||''}; }
  function add(it,q){ var c=load(), f=c.filter(function(x){return x.id===it.id;})[0]; if(f){ f.qty+=q; } else { it.qty=q; c.push(it); } save(c); }
  function toast(t){
    var d=document.createElement('div'); d.className='toast'; d.innerHTML=t+' <a href="panier.html">Voir le panier</a>';
    document.body.appendChild(d); setTimeout(function(){d.classList.add('in');},10); setTimeout(function(){d.classList.remove('in'); setTimeout(function(){d.remove();},300);},3000);
  }
  function qtyOf(b){ var box=b.closest('.pd-buy'); return box?Math.max(1,parseInt(box.querySelector('.qty input').value,10)||1):1; }
  document.addEventListener('click',function(e){
    var b=e.target.closest('.add-cart'); if(b){ add(item(b),qtyOf(b)); toast('Produit ajouté au panier.'); return; }
    var r=e.target.closest('.b2b-req'); if(r){ add(item(r),qtyOf(r)); location.href='panier.html#b2b'; return; }
    var d=e.target.closest('.qty button'); if(d && !d.dataset.k){ var i=d.parentNode.querySelector('input'); i.value=Math.max(1,(parseInt(i.value,10)||1)+parseInt(d.dataset.d,10)); }
  });

  // Mega menu
  var cb=document.querySelector('.cb-btn'), cball=document.querySelector('.cb-all');
  if(cb){
    cb.addEventListener('click',function(e){ e.stopPropagation(); var o=cball.classList.toggle('open'); cb.setAttribute('aria-expanded',o?'true':'false'); });
    document.addEventListener('click',function(e){ if(!e.target.closest('.mega')){ cball.classList.remove('open'); cb.setAttribute('aria-expanded','false'); } });
  }

  // Suggestions de recherche
  var DATA=null;
  function data(cb2){ if(DATA){ cb2(DATA); return; } fetch('produits.json').then(function(r){return r.json();}).then(function(d){ DATA=d; cb2(d); }).catch(function(){}); }
  function match(p,q){ var h=(p.n+' '+p.s+' '+p.b+' '+(p.k||'')).toLowerCase(); return q.split(/\s+/).every(function(w){ return h.indexOf(w)>=0; }); }
  document.querySelectorAll('.sh-search').forEach(function(f){
    var i=f.querySelector('input'), box=f.querySelector('.sugg');
    i.addEventListener('input',function(){
      var q=i.value.trim().toLowerCase(); if(q.length<2){ box.hidden=true; return; }
      data(function(d){
        var r=d.filter(function(p){return match(p,q);}).slice(0,7);
        box.innerHTML=r.length?r.map(function(p){ return '<a href="'+p.u+'"><img src="'+p.i+'" alt=""><span><b>'+esc(p.n)+'</b><small>'+esc(p.b)+(p.s?' - '+esc(p.s):'')+'</small></span><em>'+(p.p?fmt(p.p)+' DH':'Sur devis')+'</em></a>'; }).join('')+'<a class="sg-all" href="recherche.html?q='+encodeURIComponent(i.value)+'">Voir tous les résultats</a>'
          :'<div class="sg-none">Aucun résultat. <a href="panier.html#b2b">Demandez-nous cette référence</a></div>';
        box.hidden=false;
      });
    });
    document.addEventListener('click',function(e){ if(!f.contains(e.target)){ box.hidden=true; } });
  });

  // Listes : filtres, tri, recherche
  var list=document.getElementById('plist');
  if(list){
    var cards=[].slice.call(list.querySelectorAll('.pc')), fac=document.querySelector('.facets'), nres=document.querySelector('.nores'), nEl=document.querySelector('.lst-n b');
    var q=new URLSearchParams(location.search).get('q')||'';
    if(q){ q=q.trim().toLowerCase(); var si=document.getElementById('sq'); if(si){ si.value=q; } var lh=document.getElementById('lh'); if(lh){ lh.textContent='Résultats pour : '+q; } }
    function vals(n){ return fac?[].slice.call(fac.querySelectorAll('input[name='+n+']:checked')).map(function(x){return x.value;}):[]; }
    function apply(){
      var br=vals('brand'), ca=vals('cat'), di=vals('dispo'), et=vals('etat'), pr=vals('priced').length, n=0;
      cards.forEach(function(c){
        var ok=(!br.length||br.indexOf(c.dataset.brand)>=0)&&(!ca.length||ca.indexOf(c.dataset.cat)>=0)&&(!di.length||di.indexOf(c.dataset.dispo)>=0)&&(!et.length||et.indexOf(c.dataset.etat)>=0)&&(!pr||+c.dataset.price>0)&&(!q||q.split(/\s+/).every(function(w){return c.dataset.q.indexOf(w)>=0;}));
        c.hidden=!ok; if(ok){n++;}
      });
      if(nEl){ nEl.textContent=n; } if(nres){ nres.hidden=n>0; }
    }
    if(fac){
      fac.addEventListener('change',apply);
      fac.querySelector('.fx-reset').addEventListener('click',function(){ fac.querySelectorAll('input').forEach(function(x){x.checked=false;}); apply(); });
      var op=document.querySelector('.fx-open'), cl=fac.querySelector('.fx-close');
      if(op){ op.addEventListener('click',function(){ fac.classList.add('open'); document.body.classList.add('noscroll'); }); }
      cl.addEventListener('click',function(){ fac.classList.remove('open'); document.body.classList.remove('noscroll'); });
    }
    var bbs=[].slice.call(document.querySelectorAll('.bbar button[data-b]'));
    function syncBar(){ var br=vals('brand'); bbs.forEach(function(x){ x.setAttribute('aria-pressed', br.indexOf(x.dataset.b)>=0?'true':'false'); }); }
    var mq=new URLSearchParams(location.search).get('marque');
    if(mq&&fac){ var mi=fac.querySelector('input[name=brand][value="'+mq+'"]'); if(mi){ mi.checked=true; } }
    bbs.forEach(function(x){ x.addEventListener('click',function(){
      var i=fac&&fac.querySelector('input[name=brand][value="'+x.dataset.b+'"]'); if(i){ i.checked=!i.checked; apply(); syncBar(); }
    }); });
    if(fac){ fac.addEventListener('change',syncBar); }
    syncBar();
    var so=document.querySelector('.sort select');
    if(so){ so.addEventListener('change',function(){
      var v=so.value, arr=cards.slice();
      if(v==='pa'){ arr.sort(function(a,b){ return (+a.dataset.price||1e12)-(+b.dataset.price||1e12); }); }
      else if(v==='pd'){ arr.sort(function(a,b){ return (+b.dataset.price)-(+a.dataset.price); }); }
      else if(v==='az'){ arr.sort(function(a,b){ return a.dataset.name.localeCompare(b.dataset.name); }); }
      arr.forEach(function(c){ list.appendChild(c); });
    }); }
    apply();
  }

  // Panier
  var cl2=document.getElementById('cart-list'), form=document.getElementById('order-form');
  function render(){
    if(!cl2){return;}
    var c=load(), tot=0, allp=true;
    cl2.innerHTML=c.map(function(i,k){
      var line=i.price*i.qty; tot+=line; if(!i.price){allp=false;}
      return '<div class="cl"><img src="'+esc(i.img)+'" alt=""><div class="cl-i"><a href="'+esc(i.url)+'">'+esc(i.name)+'</a><small>'+(i.sku?'Réf. '+esc(i.sku):'')+'</small><small>'+(i.price?fmt(i.price)+' DH TTC':'Prix sur demande')+'</small></div>'+
        '<div class="qty"><button type="button" data-k="'+k+'" data-d="-1">-</button><input value="'+i.qty+'" data-k="'+k+'" aria-label="Quantité"><button type="button" data-k="'+k+'" data-d="1">+</button></div>'+
        '<b class="cl-t">'+(i.price?fmt(line)+' DH':'Sur devis')+'</b><button type="button" class="cl-rm" data-k="'+k+'" aria-label="Retirer">&times;</button></div>';
    }).join('');
    document.querySelector('.cart-empty').hidden=c.length>0;
    var t=document.getElementById('cart-total');
    t.innerHTML=!c.length?'':(tot===0?'<span>Total</span><b>Sur devis</b><small>Prix et délai de livraison envoyés sous 24 heures ouvrées.</small>'
      :'<span>Total'+(allp?'':' (hors produits sur devis)')+'</span><b>'+fmt(tot)+' DH TTC</b><small>soit '+fmt(tot/1.2)+' DH HT. Livraison confirmée avec la commande.</small>');
  }
  if(cl2){
    render();
    cl2.addEventListener('click',function(e){ var b=e.target.closest('button'); if(!b){return;} var c=load(), k=+b.dataset.k;
      if(b.classList.contains('cl-rm')){ c.splice(k,1); } else if(b.dataset.d){ c[k].qty=Math.max(1,c[k].qty+parseInt(b.dataset.d,10)); } save(c); render(); });
    cl2.addEventListener('change',function(e){ var i=e.target; if(i.dataset.k){ var c=load(); c[+i.dataset.k].qty=Math.max(1,parseInt(i.value,10)||1); save(c); render(); } });
  }
  function post(url,data){
    return fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),keepalive:true})
      .then(function(r){ return r.json().catch(function(){ return {ok:r.status===404||r.status===405,apercu:true}; }); });
  }
  // Enregistrement côté serveur (avec bon de commande éventuel). Renvoie {ok, ref, suivi} ou {apercu:true} sans serveur.
  function record(f,type,lines,extra){
    var d=new FormData(f), c=type==='configurateur'?[]:load(), u={}, fd=new FormData();
    c.forEach(function(i){ if(i.univ){ u[i.univ]=1; } });
    var uk=Object.keys(u);
    var v=Object.assign({type:type,nom:d.get('name')||'',societe:d.get('company')||'',ice:d.get('ice')||'',email:d.get('email')||'',
      telephone:d.get('phone')||'',ville:d.get('city')||'',contenu:lines.join('\n'),univers:uk.length===1?uk[0]:(type==='configurateur'?'infra':''),site_web:d.get('site_web')||'',
      lignes:JSON.stringify(c.map(function(i){ return {id:i.id,sku:i.sku,nom:i.name,qte:i.qty,prix:i.price}; }))},extra||{});
    Object.keys(v).forEach(function(k){ fd.append(k,v[k]); });
    var bc=f.querySelector('input[type=file]'); if(bc&&bc.files&&bc.files[0]){ fd.append('bc',bc.files[0]); }
    return fetch('api/demande.php',{method:'POST',body:fd}).then(function(r){ return r.json().catch(function(){ return {ok:false,apercu:true}; }); }).catch(function(){ return {ok:false,apercu:true}; });
  }
  function done(f,j,subj,lines){
    if(j&&j.ok&&j.ref){
      var o=f.querySelector('.osent');
      o.innerHTML='<b>Merci, votre demande '+esc(j.ref)+' est enregistrée.</b> Un commercial vous répond sous 24 heures ouvrées. <a href="'+esc(j.suivi)+'">Suivre ma demande</a>';
      o.hidden=false; f.querySelectorAll('input,select,textarea,button').forEach(function(x){ x.disabled=true; });
      if(f.id==='order-form'){ save([]); render(); }
      o.scrollIntoView({behavior:'smooth',block:'center'});
    } else if(j&&j.erreur&&!j.apercu){ var e=f.querySelector('.ferr'); if(!e){ e=document.createElement('p'); e.className='ferr'; f.querySelector('button[type=submit]').before(e); } e.textContent=j.erreur; e.hidden=false; }
    else { send(f,subj,lines); }       // sans serveur (aperçu) : envoi par la messagerie
  }
  function send(f,subj,lines){
    var txt=lines.join('\n');
    window.location.href='mailto:'+f.dataset.to+'?subject='+encodeURIComponent(subj)+'&body='+encodeURIComponent(txt);
    if(f.dataset.wa){ setTimeout(function(){ window.open('https://wa.me/'+f.dataset.wa+'?text='+encodeURIComponent(txt),'_blank'); },600); }
    f.querySelector('.osent').hidden=false;
  }
  if(form){
    var mode='order';
    function setMode(m){
      mode=m;
      form.querySelectorAll('.otab').forEach(function(t){ t.classList.toggle('on',t.dataset.mode===m); });
      form.querySelectorAll('.omode').forEach(function(p){ p.hidden=p.dataset.for!==m; });
      form.querySelectorAll('.only-order').forEach(function(p){ p.hidden=m!=='order'; });
      form.querySelector('[name=ice]').required=(m==='b2b');
      form.querySelector('#osubmit span').textContent=m==='order'?'Envoyer la commande':'Demander mon prix pro';
    }
    form.querySelectorAll('.otab').forEach(function(t){ t.addEventListener('click',function(){ setMode(t.dataset.mode); }); });
    if(location.hash==='#b2b'){ setMode('b2b'); }
    form.addEventListener('submit',function(ev){
      ev.preventDefault();
      var d=new FormData(form), c=load(), tot=0;
      var lines=c.map(function(i){ tot+=i.price*i.qty; return '- '+i.qty+' x '+i.name+(i.sku?' (réf. '+i.sku+')':'')+(i.price?' : '+fmt(i.price)+' DH TTC':' : prix sur demande'); });
      var body=[(mode==='order'?'COMMANDE':'DEMANDE DE PRIX PRO B2B'),''].concat(lines.length?lines:['(aucun produit dans le panier)']);
      if(mode==='order'&&tot){ body.push('Total public : '+fmt(tot)+' DH TTC'); }
      body.push('');
      [['name','Nom'],['company','Société'],['ice','ICE'],['email','E-mail'],['phone','Téléphone'],['city','Ville'],['address','Adresse']].forEach(function(k){ if(d.get(k[0])){ body.push(k[1]+' : '+d.get(k[0])); } });
      if(mode==='order'){ body.push('Paiement : '+d.get('payment')); }
      if(d.get('message')){ body.push('', d.get('message')); }
      var sb=form.querySelector('#osubmit'); sb.disabled=true;
      var subj=(mode==='order'?'Commande':'Demande de prix pro B2B')+' - '+(d.get('company')||d.get('name')||'');
      record(form,mode==='order'?'commande':'devis',body,{total:mode==='order'?tot:0}).then(function(j){ sb.disabled=false; done(form,j,subj,body); });
    });
  }
  var cfg=document.getElementById('cfg');
  if(cfg){
    cfg.addEventListener('submit',function(ev){
      ev.preventDefault(); var d=new FormData(cfg);
      var L=['CONFIGURATEUR SERVEUR',''];
      [['usage','Usage'],['marque','Marque'],['format','Format'],['users','Utilisateurs ou VM'],['ram','Mémoire'],['stockage','Stockage utile'],['redondance','Alimentation'],['qty','Quantité']].forEach(function(k){ L.push(k[1]+' : '+(d.get(k[0])||'')); });
      L.push('Services : '+(d.getAll('svc').join(', ')||'aucun'),'');
      [['name','Nom'],['company','Société'],['email','E-mail'],['phone','Téléphone'],['city','Ville']].forEach(function(k){ L.push(k[1]+' : '+(d.get(k[0])||'')); });
      if(d.get('message')){ L.push('',d.get('message')); }
      record(cfg,'configurateur',L).then(function(j){ done(cfg,j,'Configuration serveur - '+(d.get('company')||''),L); });
    });
  }

  // Compte pro
  var AR=document.documentElement.lang==='ar';
  var T=AR?{champ:'المرجو ملء هذا الحقل : ',mail:'البريد الإلكتروني غير صحيح.',ice:'يتكون رقم ICE من 15 رقما.',ok:'المرجو الموافقة على معالجة معطياتكم.',err:'حدث خطأ، المرجو إعادة المحاولة.',net:'تعذر الاتصال. تحققوا من الشبكة وأعيدوا المحاولة.',deja:'<b>لديكم حساب مهني أو طلب قيد المعالجة.</b> سيتصل بكم مستشاركم التجاري قريبا.',iceO:'ICE (اختياري)'}
               :{champ:'Merci de compléter ce champ : ',mail:'Adresse e-mail invalide.',ice:"L'ICE comporte 15 chiffres.",ok:"Merci d'accepter le traitement de vos données.",err:'Une erreur est survenue, réessayez.',net:'Connexion impossible. Vérifiez votre réseau et réessayez.',deja:'<b>Vous avez déjà un compte pro ou une demande en cours.</b> Votre commercial vous recontacte rapidement.',iceO:'ICE (facultatif)'};
  var pro=document.getElementById('pro-form');
  if(pro){
    var iceL=pro.querySelector('.ice-l');
    function iceReq(){ var t=pro.querySelector('[name=type]:checked').value, r=(t==='entreprise'||t==='revendeur'); pro.ice.required=r; iceL.firstChild.textContent=r?'ICE':T.iceO; }
    pro.addEventListener('change',iceReq); iceReq();
    pro.addEventListener('submit',function(ev){
      ev.preventDefault();
      var er=pro.querySelector('.ferr'), d=new FormData(pro);
      function bad(m,f){ er.textContent=m; er.hidden=false; if(f){ f.focus(); } }
      er.hidden=true;
      var bad1=[].slice.call(pro.querySelectorAll('input[required]')).filter(function(i){ return i.type!=='checkbox'&&!i.value.trim(); })[0];
      if(bad1){ return bad(T.champ+bad1.parentNode.firstChild.textContent.trim()+(AR?'':'.'),bad1); }
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.get('email'))){ return bad(T.mail,pro.email); }
      var ice=(d.get('ice')||'').replace(/\D/g,''); if(ice&&ice.length!==15){ return bad(T.ice,pro.ice); }
      if(!pro.consentement.checked){ return bad(T.ok,pro.consentement); }
      var btn=pro.querySelector('button[type=submit]'); btn.disabled=true;
      var data={type:d.get('type'),societe:d.get('societe'),ice:ice,nom:d.get('nom'),fonction:d.get('fonction'),email:d.get('email'),telephone:d.get('telephone'),
        ville:d.get('ville'),univers:d.getAll('univers'),message:d.get('message'),consentement:1,site_web:d.get('site_web')};
      post('api/inscription.php',data).then(function(j){
        btn.disabled=false;
        if(!j.ok){ return bad(AR?T.err:(j.erreur||T.err)); }
        pro.querySelectorAll('input,textarea,button,fieldset').forEach(function(x){ x.disabled=true; });
        var ok=pro.querySelector('.osent'); ok.hidden=false;
        if(j.deja){ ok.innerHTML=T.deja; }
        ok.scrollIntoView({behavior:'smooth',block:'center'});
      }).catch(function(){ btn.disabled=false; bad(T.net); });
    });
  }

  // WhatsApp : commercial selon l'univers consulté (liste gérée dans le backoffice)
  var COMS=[]; try{ COMS=JSON.parse(document.getElementById('wa-data').textContent)||[]; }catch(e){}
  fetch('api/public.php').then(function(r){ return r.json(); }).then(function(j){ if(j.ok&&j.commerciaux.length){ COMS=j.commerciaux; fill(); } if(j.ok&&j.carte){ document.querySelectorAll('option[data-carte]').forEach(function(o){ o.disabled=false; o.hidden=false; }); } }).catch(function(){});
  var UL=AR?{postes:'حواسيب العمل والطباعة',infra:'البنية التحتية : خوادم، تخزين، شبكات',tous:'جميع الطلبات'}:{postes:'Postes de travail et impression',infra:'Infrastructure : serveurs, stockage, réseau',tous:'Toutes demandes'};
  function waUrl(c,msg){ return 'https://wa.me/'+c.whatsapp+'?text='+encodeURIComponent(msg); }
  function pageMsg(){ if(AR){ return 'السلام عليكم، أتواصل معكم من موقع DIGITAL BOX TECHNOLOGIES.'; } return 'Bonjour, je vous contacte depuis le site DIGITAL BOX TECHNOLOGIES ('+document.title.split(' - ')[0]+').'; }
  function pick(u){ var c=COMS.filter(function(x){ return x.univers===u; })[0]||COMS.filter(function(x){ return x.univers==='tous'; })[0]; return c||COMS[0]; }
  var wb=document.getElementById('wa-b'), wp=document.getElementById('wa-p'), wl=document.getElementById('wa-l');
  function fill(){
    if(!wl){ return; }
    var cur=document.body.dataset.univ||'', list=COMS.slice().sort(function(a,b){ return (b.univers===cur)-(a.univers===cur); });
    wl.innerHTML=list.map(function(c){ return '<a href="'+waUrl(c,pageMsg())+'" target="_blank" rel="noopener"><b>'+esc(UL[c.univers]||c.nom)+'</b><small>'+esc(c.nom)+'</small></a>'; }).join('');
    if(wb){ wb.hidden=!COMS.length; }
  }
  fill();
  if(wb){
    function wclose(){ wp.hidden=true; wb.setAttribute('aria-expanded','false'); }
    wb.addEventListener('click',function(e){ e.stopPropagation(); var o=wp.hidden; wp.hidden=!o; wb.setAttribute('aria-expanded',o?'true':'false'); });
    wp.querySelector('.wa-x').addEventListener('click',wclose);
    document.addEventListener('click',function(e){ if(!wp.hidden&&!e.target.closest('#wa')){ wclose(); } });
    document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&!wp.hidden){ wclose(); wb.focus(); } });
  }
  document.addEventListener('click',function(e){
    var a=e.target.closest('.wa-ask'); if(!a||!COMS.length){ return; }
    var c=pick(a.dataset.univ||document.body.dataset.univ||''); window.open(waUrl(c,a.dataset.msg||pageMsg()),'_blank','noopener');
  });
  badge();
})();

/* Application installable : service worker et bandeau d'installation (Android, Chrome, Edge). */
(function(){
  if('serviceWorker' in navigator && location.protocol!=='file:'){
    window.addEventListener('load',function(){ navigator.serviceWorker.register('sw.js').catch(function(){}); });
  }
  var bar=document.getElementById('appbar'), evt=null, KEY='dbt-appbar';
  function get(){ try{ return +localStorage.getItem(KEY)||0; }catch(e){ return 0; } }
  function set(v){ try{ localStorage.setItem(KEY,String(v)); }catch(e){} }
  var standalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone;
  function install(){
    if(!evt){ return; }
    evt.prompt(); evt.userChoice.then(function(c){ if(c.outcome==='accepted'){ set(Date.now()+3650*864e5); } evt=null; hideAll(); });
  }
  function show(v){ if(bar){ bar.hidden=!v; document.body.classList.toggle('appbar-on',!!v); } }
  function hideAll(){ show(false); document.querySelectorAll('.app-li').forEach(function(l){ l.hidden=true; }); }
  window.addEventListener('beforeinstallprompt',function(e){
    e.preventDefault(); evt=e; if(standalone){ return; }
    document.querySelectorAll('.app-li').forEach(function(l){ l.hidden=false; });
    if(bar&&get()<Date.now()&&window.innerWidth<900){ setTimeout(function(){ show(true); },2500); }
  });
  window.addEventListener('appinstalled',function(){ set(Date.now()+3650*864e5); hideAll(); });
  document.addEventListener('click',function(e){
    if(e.target.closest('#appbar-i, .app-inst')){ install(); }
    if(e.target.closest('#appbar-x')){ set(Date.now()+30*864e5); show(false); }
  });
  if(standalone){ document.documentElement.classList.add('app'); }
})();
