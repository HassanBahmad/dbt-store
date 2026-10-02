/* DIGITAL BOX TECHNOLOGIES : prix à jour, prix pro, statistiques, suivi de commande, espace client, avis. */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function fmt(v) { var s = (Math.round(v * 100) / 100).toFixed(2).replace('.', ','); s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ' '); return s.replace(/,00$/, ''); }
  function date(iso) { return iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''; }
  function json(r) { return r.json().catch(function () { return { ok: false, apercu: true }; }); }
  function get(u) { return fetch(u, { credentials: 'same-origin' }).then(json).catch(function () { return { ok: false, apercu: true }; }); }
  var CSRF = '';
  function post(u, b) {
    return fetch(u, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF': CSRF }, body: JSON.stringify(b) })
      .then(json).catch(function () { return { ok: false, apercu: true }; });
  }
  var params = new URLSearchParams(location.search);
  var STAPES = ['nouveau', 'devis_envoye', 'confirme', 'commande_fournisseur', 'expedie', 'livre'];
  var LAB = { nouveau: 'Demande reçue', devis_envoye: 'Devis envoyé', confirme: 'Commande confirmée', commande_fournisseur: 'Commandée chez le distributeur', expedie: 'Expédiée', livre: 'Livrée', annule: 'Annulée' };
  var TYP = { commande: 'Commande', devis: 'Demande de prix pro', configurateur: 'Configuration serveur' };

  // ------------------------------------------------------------------ statistiques anonymes
  function track(t, k) {
    if (!k) return;
    try { var b = JSON.stringify({ t: t, k: String(k).slice(0, 120) }); if (navigator.sendBeacon) navigator.sendBeacon('api/track.php', new Blob([b], { type: 'application/json' })); } catch (e) {}
  }
  var page = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '') || 'index';
  track('page', page);
  var pd = $('.pd[data-pid]'); if (pd) track('produit', pd.dataset.pid);
  if (page === 'recherche' && params.get('q')) {
    setTimeout(function () { var n = +(($('.lst-n b') || {}).textContent || 0); track(n ? 'recherche' : 'recherche_vide', params.get('q').toLowerCase().trim()); }, 300);
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('.wa-ask, #wa-l a')) track('whatsapp', page);
    var a = e.target.closest('.add-cart'); if (a) track('panier', a.dataset.name);
  }, true);

  // ------------------------------------------------------------------ prix et disponibilités à jour, prix pro du client connecté
  function priceHtml(p, old, big, pro) {
    if (!p) return '<div class="pr req' + (big ? ' big' : '') + '"><b>Prix sur demande</b><span>Réponse sous 24 h ouvrées</span></div>';
    return '<div class="pr' + (big ? ' big' : '') + (pro ? ' pro' : '') + '">' + (old && old > p ? '<s>' + fmt(old) + ' DH</s>' : '') + '<b>' + fmt(p) + ' DH<small> TTC</small></b><span>' +
      (pro ? 'Votre prix pro' + (pro.r ? ' (-' + fmt(pro.r) + ' %)' : '') : fmt(p / 1.2) + ' DH HT') + '</span></div>';
  }
  function apply(map, pro) {
    $$('[data-id].add-cart').forEach(function (b) {
      var id = b.dataset.id, d = map[id]; if (!d) return;
      var box = b.closest('.pc') || b.closest('.pd-buy'); if (!box) return;
      var p = pro && pro.prix[id] ? pro.prix[id] : d[0], old = pro && pro.prix[id] ? d[0] : d[1];
      var pr = $('.pr', box); if (pr) pr.outerHTML = priceHtml(p, old, box.classList.contains('pd-buy'), pro && pro.prix[id] ? pro : null);
      $$('[data-id="' + id + '"]', box).forEach(function (x) { x.dataset.price = p || ''; });
      if (box.classList.contains('pc')) { box.dataset.price = p || 0; box.hidden = box.hidden || !!d[3]; }
      var st = $('.st', box.closest('.pd') || box);
      if (st && d[2]) { st.textContent = d[2]; st.className = 'st ' + (d[2] === 'En stock' ? 'ok' : d[2] === 'Rupture' ? 'ko' : 'wt'); }
    });
  }
  if ($('[data-id].add-cart')) {
    get('api/catalogue.php').then(function (c) {
      if (!c.ok) return;
      if (/(^|; )dbtpro=1/.test(document.cookie)) get('api/client.php?a=prix').then(function (j) { apply(c.p, j.ok ? { prix: j.prix, r: j.remise } : null); });
      else apply(c.p, null);
    });
  }

  // ------------------------------------------------------------------ suivi de commande
  function timeline(statut, hist) {
    var done = {}; (hist || []).forEach(function (h) { done[h.etape] = h; });
    if (statut === 'annule') return '<p class="ferr">Cette demande a été annulée. Contactez votre commercial pour plus d\'informations.</p>';
    var cur = STAPES.indexOf(statut);
    return '<ol class="tl">' + STAPES.map(function (s, i) {
      var h = done[s], cls = i < cur ? 'ok' : (i === cur ? 'on' : '');
      return '<li class="' + cls + '"><i></i><div><b>' + LAB[s] + '</b>' + (h ? '<small>' + date(h.quand) + '</small>' + (h.note ? '<p>' + esc(h.note) + '</p>' : '') : '') + '</div></li>';
    }).join('') + '</ol>';
  }
  function payNote() {
    var r = params.get('paiement');
    if (r === 'ok') return '<p class="pay-ok">Paiement accepté. Merci, vous recevez une confirmation par e-mail.</p>';
    if (r === 'attente') return '<p class="pay-wt">Paiement en cours de confirmation par la banque. Actualisez cette page dans quelques instants.</p>';
    if (r === 'ko') return '<p class="ferr">Le paiement n\'a pas abouti. Vous pouvez réessayer ou choisir un autre moyen de paiement avec votre commercial.</p>';
    return '';
  }
  var sv = $('#suivi');
  if (sv) {
    var showSuivi = function (ref, k) {
      get('api/suivi.php?ref=' + encodeURIComponent(ref) + '&k=' + encodeURIComponent(k)).then(function (j) {
        if (j.apercu) j = { ok: true, ref: ref || 'D-2026-00012', cree_le: new Date(Date.now() - 4 * 864e5).toISOString(), statut: 'commande_fournisseur', type: 'commande', commercial: 'Commercial Postes de travail', whatsapp: '212661774405',
          historique: [{ etape: 'nouveau', quand: new Date(Date.now() - 4 * 864e5).toISOString() }, { etape: 'devis_envoye', quand: new Date(Date.now() - 3 * 864e5).toISOString() },
                       { etape: 'confirme', quand: new Date(Date.now() - 2 * 864e5).toISOString(), note: 'Bon de commande reçu, merci.' }, { etape: 'commande_fournisseur', quand: new Date(Date.now() - 864e5).toISOString(), note: 'Livraison prévue en fin de semaine.' }], apercu: true };
        if (!j.ok) { var e = $('#suivi-f .ferr'); e.textContent = j.erreur || 'Demande introuvable.'; e.hidden = false; return; }
        sv.innerHTML = (j.apercu ? '<p class="demo-n">Aperçu : exemple de suivi.</p>' : '') + '<div class="sv-h"><div><span class="eb">' + esc(TYP[j.type] || 'Demande') + '</span><h2>' + esc(j.ref) + '</h2><p class="muted">Reçue le ' + date(j.cree_le) + '</p></div>' +
          (j.whatsapp ? '<a class="btn bwa" target="_blank" rel="noopener" href="https://wa.me/' + esc(j.whatsapp) + '?text=' + encodeURIComponent('Bonjour, je vous contacte au sujet de ma demande ' + j.ref + '.') + '">WhatsApp ' + esc(j.commercial || '') + '</a>' : '') + '</div>' + payNote() +
          ((j.devis || j.payer) ? '<div class="sv-a">' + (j.devis ? '<a class="btn bl" href="' + esc(j.devis) + '" target="_blank" rel="noopener">Voir mon devis</a>' : '') +
            (j.payer ? '<a class="btn bo" href="' + esc(j.payer) + '">Payer ' + fmt(j.total) + ' DH par carte</a><small>Paiement sécurisé CMI, 3D Secure</small>' : '') + '</div>' : '') +
          (j.paiement === 'paye' ? '<p class="pay-ok">Paiement reçu. Merci.</p>' : '') + timeline(j.statut, j.historique);
      });
    };
    if (params.get('ref')) showSuivi(params.get('ref'), params.get('k') || '');
    $('#suivi-f') && $('#suivi-f').addEventListener('submit', function (e) { e.preventDefault(); showSuivi(e.target.ref.value.trim().toUpperCase(), e.target.k.value.trim()); });
  }

  // ------------------------------------------------------------------ espace client
  var ec = $('#ec');
  if (ec) {
    var auth = $('#ec-auth'), app = $('#ec-app'), fl = $('#ec-login'), fs = $('#ec-set');
    var err = function (f, m) { var e = $('.ferr', f); e.textContent = m; e.hidden = false; };
    var DEMO = { ok: true, apercu: true, client: { societe: 'Société Exemple SARL', nom: 'Salma Exemple', remise: 5, commercial: 'Commercial Postes de travail', commercial_wa: '212661774405' },
      demandes: [{ id: 2, ref: 'D-2026-00012', cree_le: new Date(Date.now() - 2 * 864e5).toISOString(), statut: 'commande_fournisseur', type: 'commande', total: 0, lien: 'suivi-commande.html?ref=D-2026-00012&k=demo', lignes: [{ nom: 'Ordinateur portable Dell Pro 14', qte: 15 }, { nom: 'Multifonction laser HP LaserJet Pro MFP 4102fdw', qte: 3 }] },
                 { id: 1, ref: 'D-2026-00004', cree_le: new Date(Date.now() - 40 * 864e5).toISOString(), statut: 'livre', type: 'commande', total: 0, lien: 'suivi-commande.html?ref=D-2026-00004&k=demo', lignes: [{ nom: 'Onduleur Eaton 5E 1600 VA USB', qte: 4 }] }] };
    var render = function (j) {
      auth.hidden = true; app.hidden = false; var c = j.client;
      var enc = j.demandes.filter(function (d) { return ['confirme', 'commande_fournisseur', 'expedie'].indexOf(d.statut) >= 0; }).length;
      app.innerHTML = (j.apercu ? '<p class="demo-n">Aperçu : exemple d\'espace client.</p>' : '') +
        '<div class="ec-h"><div><span class="eb">Espace client pro</span><h1>' + esc(c.societe) + '</h1><p class="muted">Connecté en tant que ' + esc(c.nom) + '</p></div><button class="btn bl" id="ec-out">Se déconnecter</button></div>' +
        '<div class="ec-k"><div><b>' + (c.remise ? '-' + fmt(c.remise) + ' %' : 'Sur devis') + '</b><span>Votre remise pro, appliquée sur les prix affichés du catalogue</span></div>' +
        '<div><b>' + enc + '</b><span>commande(s) en cours</span></div>' +
        '<div class="ec-c"><span>Votre commercial</span><b>' + esc(c.commercial || 'DIGITAL BOX TECHNOLOGIES') + '</b>' + (c.commercial_wa ? '<a class="btn bwa" target="_blank" rel="noopener" href="https://wa.me/' + esc(c.commercial_wa) + '?text=' + encodeURIComponent('Bonjour, ' + c.societe + ' ici.') + '">WhatsApp</a>' : '') + '</div></div>' +
        '<div class="sec-h"><h2>Vos commandes et devis</h2><a href="recherche.html">Commander à nouveau</a></div>' +
        (j.demandes.length ? '<div class="ec-t">' + j.demandes.map(function (d) {
          return '<article class="ec-d"><div class="ec-dh"><div><b>' + esc(d.ref) + '</b><small>' + esc(TYP[d.type] || d.type) + ' du ' + date(d.cree_le) + '</small></div><span class="stp stp-' + esc(d.statut) + '">' + esc(LAB[d.statut] || d.statut) + '</span></div>' +
            (d.lignes && d.lignes.length ? '<ul>' + d.lignes.map(function (l) { return '<li>' + l.qte + ' x ' + esc(l.nom) + '</li>'; }).join('') + '</ul>' : '') +
            '<div class="ec-da"><a class="btn bl" href="' + esc(d.lien) + '">Suivre</a>' + (d.lignes && d.lignes.length ? '<button class="btn bp" data-reorder="' + d.id + '">Recommander</button>' : '') + '</div></article>';
        }).join('') + '</div>' : '<p class="nores">Aucune commande pour le moment. Parcourez le <a href="index.html">catalogue</a> : vos prix pro s\'affichent automatiquement.</p>');
      $('#ec-out').addEventListener('click', function () { post('api/client.php?a=deconnexion', {}).then(function () { location.href = 'espace-client.html'; }); });
      $$('[data-reorder]', app).forEach(function (b) {
        b.addEventListener('click', function () {
          if (j.apercu) { b.textContent = 'Recommande envoyée (aperçu)'; b.disabled = true; return; }
          b.disabled = true; post('api/client.php?a=recommander', { id: +b.dataset.reorder }).then(function (r) { b.textContent = r.ok ? 'Recommande ' + r.ref + ' envoyée' : (r.erreur || 'Erreur'); if (r.ok) setTimeout(load, 1200); });
        });
      });
    };
    var load = function () { get('api/client.php?a=tableau').then(function (j) { if (j.ok) render(j); else { auth.hidden = false; app.hidden = true; } }); };
    if (params.get('c') && params.get('t')) { auth.hidden = false; fl.hidden = true; fs.hidden = false; }
    get('api/client.php?a=etat').then(function (j) {
      CSRF = j.csrf || '';
      if (j.connecte && !fs.offsetParent) load(); else auth.hidden = false;
      if (j.apercu) ec.dataset.apercu = '1';
    });
    fl.addEventListener('submit', function (e) {
      e.preventDefault();
      if (ec.dataset.apercu) return render(DEMO);
      post('api/client.php?a=connexion', { email: fl.email.value.trim(), mdp: fl.mdp.value }).then(function (j) { if (j.ok) { CSRF = j.csrf; load(); } else err(fl, j.erreur || 'Connexion impossible.'); });
    });
    $('#ec-forgot').addEventListener('click', function () {
      var m = fl.email.value.trim(); if (!m) return err(fl, 'Saisissez votre e-mail puis cliquez à nouveau sur « Mot de passe oublié ».');
      post('api/client.php?a=oubli', { email: m }).then(function () { var o = $('.osent', fl); o.textContent = 'Si cette adresse correspond à un compte pro validé, un lien vient d\'être envoyé.'; o.hidden = false; $('.ferr', fl).hidden = true; });
    });
    fs.addEventListener('submit', function (e) {
      e.preventDefault();
      if (fs.mdp.value !== fs.mdp2.value) return err(fs, 'Les deux mots de passe ne correspondent pas.');
      post('api/client.php?a=activer', { c: +params.get('c'), t: params.get('t'), mdp: fs.mdp.value }).then(function (j) {
        if (j.ok) { CSRF = j.csrf; history.replaceState(null, '', 'espace-client.html'); load(); } else err(fs, j.erreur || 'Lien invalide.');
      });
    });
  }

  // ------------------------------------------------------------------ avis clients
  $$('.avis-p').forEach(function (box) {
    var prod = box.dataset.produit || '', list = $('.avis-l', box);
    get('api/avis.php' + (prod ? '?produit=' + encodeURIComponent(prod) : '')).then(function (j) {
      if (!j.ok || !j.avis.length) return;
      var stars = function (n) { return '<span class="stars" aria-label="' + n + ' sur 5">' + '★★★★★'.slice(0, n) + '<em>' + '★★★★★'.slice(n) + '</em></span>'; };
      list.innerHTML = (!prod && j.total ? '<p class="avis-m">' + stars(Math.round(j.moyenne)) + ' <b>' + String(j.moyenne).replace('.', ',') + '/5</b> sur ' + j.total + ' avis</p>' : '') +
        j.avis.map(function (a) { return '<blockquote class="avis">' + stars(+a.note) + '<p>' + esc(a.texte) + '</p><footer><b>' + esc(a.nom) + '</b>' + (a.societe ? ', ' + esc(a.societe) : '') + (a.ville ? ', ' + esc(a.ville) : '') + (+a.client ? ' <span class="vf">Client vérifié</span>' : '') + ' <small>' + date(a.cree_le) + '</small></footer></blockquote>'; }).join('');
    });
    $('.avis-open', box).addEventListener('click', function () {
      if ($('.avis-f', box)) return $('.avis-f', box).scrollIntoView({ behavior: 'smooth' });
      var f = document.createElement('form'); f.className = 'oform avis-f';
      f.innerHTML = '<h3>Votre avis' + (prod ? ' sur ' + esc(box.dataset.nom) : '') + '</h3><div class="frow"><label>Nom<input name="nom" required maxlength="80"></label><label>Société (facultatif)<input name="societe" maxlength="120"></label>' +
        '<label>Ville<input name="ville" maxlength="80"></label><label>E-mail (non publié)<input name="email" type="email" required></label></div>' +
        '<fieldset class="opts-t"><legend>Note</legend><div class="opts">' + [5, 4, 3, 2, 1].map(function (n) { return '<label class="opt"><input type="radio" name="note" value="' + n + '"' + (n === 5 ? ' checked' : '') + '><span>' + n + ' / 5</span></label>'; }).join('') + '</div></fieldset>' +
        '<label>Votre avis<textarea name="texte" rows="4" required minlength="15" maxlength="1500"></textarea></label><input class="hp" name="site_web" tabindex="-1" autocomplete="off" aria-hidden="true">' +
        '<p class="ferr" hidden></p><button class="btn bp">Envoyer mon avis</button><div class="osent" hidden>Merci ! Votre avis sera publié après vérification par notre équipe.</div>';
      box.appendChild(f); f.nom.focus();
      f.addEventListener('submit', function (e) {
        e.preventDefault(); var d = new FormData(f), b = {}; d.forEach(function (v, k) { b[k] = v; }); b.produit = prod;
        post('api/avis.php', b).then(function (j) {
          if (j.ok || j.apercu) { $$('input,textarea,button', f).forEach(function (x) { x.disabled = true; }); $('.osent', f).hidden = false; $('.ferr', f).hidden = true; }
          else { var er = $('.ferr', f); er.textContent = j.erreur || 'Erreur.'; er.hidden = false; }
        });
      });
    });
  });
})();
