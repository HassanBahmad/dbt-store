/* Backoffice DIGITAL BOX TECHNOLOGIES : commandes, comptes pro, catalogue, statistiques, avis, commerciaux, utilisateurs, réglages. */
(function () {
  var API = '../api/admin.php', CSRF = '', DEMO = false, V = 'tableau', COMS = [], ME = null, RESET = '', ODOO = false, CMI = false;
  var OET = { draft: 'Devis', sent: 'Devis envoyé', sale: 'Commande confirmée', done: 'Verrouillé', cancel: 'Annulé' };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var CST = { nouveau: 'À valider', valide: 'Validé', refuse: 'Refusé', archive: 'Archivé' };
  var ETAPES = { nouveau: 'Demande reçue', devis_envoye: 'Devis envoyé', confirme: 'Commande confirmée', commande_fournisseur: 'Commandée chez le distributeur', expedie: 'Expédiée', livre: 'Livrée', annule: 'Annulée' };
  var PAY = { en_attente: 'Non facturé', facture: 'Facturé', paye: 'Payé' };
  var TYP = { entreprise: 'Entreprise', administration: 'Administration', revendeur: 'Revendeur', association: 'Association' };
  var DT = { commande: 'Commande', devis: 'Prix pro', configurateur: 'Configurateur' };
  var UNI = { postes: 'Postes de travail', infra: 'Infrastructure', tous: 'Tous univers' };
  var AST = { nouveau: 'À modérer', publie: 'Publié', refuse: 'Refusé' };
  function d(iso, court) { if (!iso) return ''; var x = new Date(iso); var j = x.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); return court ? j : j + ' ' + x.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
  function nb(v) { return Math.round(+v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function money(v) { return +v ? nb(v) + ' DH' : ''; }
  function wa(tel) { var t = String(tel || '').replace(/\D/g, ''); if (t.indexOf('00') === 0) t = t.slice(2); if (t.charAt(0) === '0') t = '212' + t.slice(1); return t; }
  function univ(u) { return String(u || '').split(',').filter(Boolean).map(function (x) { return UNI[x] || x; }).join(', '); }
  function com(id) { var c = COMS.filter(function (x) { return +x.id === +id; })[0]; return c ? c.nom : 'Non attribué'; }
  function admin() { return ME && ME.role === 'admin'; }
  function toast(t, bad) { var e = $('#toast'); e.textContent = t; e.className = 'toast' + (bad ? ' bad' : ''); e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { e.hidden = true; }, 2800); }
  function copy(t) { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('Copié.'); }).catch(function () { window.prompt('Copiez ce texte :', t); }); }
  function pill(s, map, cls) { return '<span class="st ' + (cls || 'st') + '-' + esc(s) + '">' + esc((map || ETAPES)[s] || s) + '</span>'; }
  function stars(n) { var s = ''; for (var i = 1; i <= 5; i++) s += '<i class="' + (i <= n ? 'on' : '') + '"></i>'; return '<span class="stars" aria-label="' + n + ' sur 5">' + s + '</span>'; }
  function opts(map, cur) { return Object.keys(map).map(function (k) { return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + esc(map[k]) + '</option>'; }).join(''); }
  function comOpts(cur, vide) { return '<option value="0">' + (vide || 'Non attribué') + '</option>' + COMS.map(function (c) { return '<option value="' + c.id + '"' + (+cur === +c.id ? ' selected' : '') + '>' + esc(c.nom) + '</option>'; }).join(''); }
  function dl(t) { return DEMO ? '#' : API + '?a=' + t; }

  // ------------------------------------------------------------------ données de démonstration (aperçu sans serveur)
  function ago(days) { return new Date(Date.now() - days * 86400000).toISOString(); }
  var DB = {
    moi: { id: 1, identifiant: 'youssef', nom: 'Youssef', email: 'contact@dbt.ma', role: 'admin', commercial_id: null, a2f: 0 },
    commerciaux: [{ id: 1, nom: 'Commercial Postes de travail', univers: 'postes', whatsapp: '212661774405', email: 'contact@dbt.ma', actif: 1 },
                  { id: 2, nom: 'Commercial Infrastructure', univers: 'infra', whatsapp: '212661774405', email: 'contact@dbt.ma', actif: 1 }],
    clients: [
      { id: 6, cree_le: ago(1.4), statut: 'nouveau', type: 'administration', societe: 'Agence urbaine (exemple)', ice: '', nom: 'Karim Exemple', fonction: 'Chef du service informatique', email: 'k.exemple@exemple.ma', telephone: '0661000001', ville: 'Rabat', univers: 'infra', message: 'Besoin de disques pour une baie HPE MSA et de deux serveurs.', commercial_id: 2, notes: '', remise: 0, actif_espace: 0 },
      { id: 5, cree_le: ago(0.4), statut: 'nouveau', type: 'entreprise', societe: 'Société Exemple SARL', ice: '001234567000012', nom: 'Salma Exemple', fonction: 'Directrice administrative', email: 's.exemple@exemple.ma', telephone: '0662000002', ville: 'Casablanca', univers: 'postes', message: '15 portables et 3 multifonctions pour un nouveau bureau.', commercial_id: 1, notes: '', remise: 0, actif_espace: 0 },
      { id: 4, cree_le: ago(9), statut: 'valide', type: 'revendeur', societe: 'Intégrateur Exemple', ice: '002345678000034', nom: 'Youness Exemple', fonction: 'Gérant', email: 'y.exemple@exemple.ma', telephone: '0663000003', ville: 'Tanger', univers: 'postes,infra', message: '', commercial_id: 2, notes: 'Revendeur, remise volume accordée.', remise: 6, actif_espace: 1, dernier_acces: ago(1) },
      { id: 3, cree_le: ago(14), statut: 'valide', type: 'association', societe: 'Association Exemple', ice: '', nom: 'Nadia Exemple', fonction: 'Coordinatrice', email: 'n.exemple@exemple.ma', telephone: '0664000004', ville: 'Fès', univers: 'postes', message: '', commercial_id: 1, notes: '', remise: 3, actif_espace: 0 },
      { id: 2, cree_le: ago(20), statut: 'refuse', type: 'entreprise', societe: 'Test', ice: '000000000000000', nom: 'Test', fonction: '', email: 'test@test.com', telephone: '0600000000', ville: '', univers: 'postes', message: '', commercial_id: null, notes: 'Inscription de test.', remise: 0, actif_espace: 0 }],
    demandes: [
      { id: 5, ref: 'D-2026-00005', cree_le: ago(0.2), maj_le: ago(0.2), statut: 'nouveau', type: 'commande', nom: 'Youness Exemple', societe: 'Intégrateur Exemple', ice: '002345678000034', email: 'y.exemple@exemple.ma', telephone: '0663000003', ville: 'Tanger', univers: 'infra', total: 9840, paiement: 'en_attente', fichier: 'bc.pdf', client_id: 4, commercial_id: 2, notes: '',
        lignes: [{ nom: 'Disque HPE 1,2 To SAS 12G 10K SFF', sku: '872479-B21', qte: 4, prix: 2460 }], contenu: 'COMMANDE\n\n- 4 x Disque HPE 1,2 To SAS 12G 10K SFF (réf. 872479-B21) : 9 840 DH\n\nBon de commande joint.\nPaiement : Virement bancaire' },
      { id: 4, ref: 'D-2026-00004', cree_le: ago(1.6), maj_le: ago(1.6), statut: 'nouveau', type: 'devis', nom: 'Salma Exemple', societe: 'Société Exemple SARL', ice: '001234567000012', email: 's.exemple@exemple.ma', telephone: '0662000002', ville: 'Casablanca', univers: 'postes', total: 0, paiement: 'en_attente', fichier: '', commercial_id: 1, notes: '',
        lignes: [{ nom: 'Ordinateur portable Dell Pro 14', sku: '', qte: 15, prix: 0 }, { nom: 'Multifonction laser HP LaserJet Pro MFP 4102fdw', sku: '2Z624F', qte: 3, prix: 0 }], contenu: 'DEMANDE DE PRIX PRO B2B\n\n- 15 x Ordinateur portable Dell Pro 14\n- 3 x Multifonction HP LaserJet Pro MFP 4102fdw (réf. 2Z624F)\n\nLivraison souhaitée sous 3 semaines.' },
      { id: 3, ref: 'D-2026-00003', cree_le: ago(6), maj_le: ago(4), statut: 'devis_envoye', odoo_id: 43, odoo_ref: 'S00043', odoo_etat: 'sent', lien_odoo: '#', lien_pdf: '#', lien_client: '#', type: 'configurateur', nom: 'Karim Exemple', societe: 'Agence urbaine (exemple)', ice: '', email: 'k.exemple@exemple.ma', telephone: '0661000001', ville: 'Rabat', univers: 'infra', total: 148000, paiement: 'en_attente', fichier: '', commercial_id: 2, notes: 'Configuration R760xs envoyée.', lignes: [],
        contenu: 'CONFIGURATEUR SERVEUR\n\nUsage : Virtualisation\nMarque : Dell\nFormat : Rack\nUtilisateurs ou VM : 20 VM\nMémoire : 256 Go\nStockage utile : 8 To\nAlimentation : Redondante\nQuantité : 2' },
      { id: 2, ref: 'D-2026-00002', cree_le: ago(8), maj_le: ago(2), statut: 'expedie', paiements: [{ cree_le: ago(5), montant: 23700, statut: 'refuse', carte: '4111 XXXX XXXX 1111' }], type: 'commande', nom: 'Nadia Exemple', societe: 'Association Exemple', ice: '', email: 'n.exemple@exemple.ma', telephone: '0664000004', ville: 'Fès', univers: 'postes', total: 23700, paiement: 'facture', fichier: '', client_id: 3, commercial_id: 1, notes: '',
        lignes: [{ nom: 'PC de bureau HP Pro Mini 400 G9', sku: '', qte: 3, prix: 7900 }], contenu: 'COMMANDE\n\n- 3 x PC de bureau HP Pro Mini 400 G9 : 23 700 DH' },
      { id: 1, ref: 'D-2026-00001', cree_le: ago(18), maj_le: ago(6), statut: 'livre', type: 'commande', nom: 'Youness Exemple', societe: 'Intégrateur Exemple', ice: '002345678000034', email: 'y.exemple@exemple.ma', telephone: '0663000003', ville: 'Tanger', univers: 'infra', total: 31500, paiement: 'paye', fichier: '', client_id: 4, commercial_id: 2, notes: 'Livré et payé.',
        lignes: [{ nom: 'Onduleur Eaton 5PX 1500i RT2U G2', sku: '5PX1500IRT2UG2', qte: 3, prix: 10500 }], contenu: 'COMMANDE\n\n- 3 x Onduleur Eaton 5PX 1500i RT2U G2 : 31 500 DH' }],
    historique: {},
    avis: [
      { id: 3, cree_le: ago(0.5), statut: 'nouveau', nom: 'Nadia', societe: 'Association Exemple', ville: 'Fès', email: 'n.exemple@exemple.ma', note: 5, texte: 'Livraison rapide des trois PC, installation expliquée au téléphone. Très bon suivi.', produit: '' },
      { id: 2, cree_le: ago(3), statut: 'nouveau', nom: 'Hamza', societe: '', ville: 'Agadir', email: 'h@exemple.ma', note: 4, texte: 'Bon prix sur le NAS, un jour de retard sur la livraison.', produit: 'NAS Synology DS923+' },
      { id: 1, cree_le: ago(12), statut: 'publie', nom: 'Youness', societe: 'Intégrateur Exemple', ville: 'Tanger', email: 'y.exemple@exemple.ma', note: 5, texte: 'Disques HPE d\'origine, reçus en 48 h avec facture. Je recommande.', produit: '' }],
    utilisateurs: [{ id: 1, identifiant: 'youssef', nom: 'Youssef', email: 'contact@dbt.ma', role: 'admin', commercial_id: null, actif: 1, a2f: 0, dernier_acces: ago(0) },
                   { id: 2, identifiant: 'infra', nom: 'Commercial Infrastructure', email: '', role: 'commercial', commercial_id: 2, actif: 1, a2f: 0, dernier_acces: ago(2) }],
    produits: null,
    reglages: { odoo_url: 'https://dbt.odoo.com', odoo_db: 'dbt', odoo_user: 'youssef@dbt.ma', odoo_key_ok: true, odoo_auto: false, odoo_prix_ht: true, cmi_actif: true, cmi_mode: 'test', cmi_clientid: '600000000', cmi_key_ok: true, cmi_callback: 'https://shop.dbt.ma/api/cmi-callback.php', email_notification: 'contact@dbt.ma', cron_url: 'https://shop.dbt.ma/api/cron.php?cle=XXXXXXXX', cron_cmd: 'php /home/compte/public_html/api/cron.php', derniere_sauvegarde: ago(0.3) }
  };
  (function () {
    var h = DB.historique, e = ['nouveau', 'devis_envoye', 'confirme', 'commande_fournisseur', 'expedie', 'livre'];
    DB.demandes.forEach(function (x) {
      var n = e.indexOf(x.statut); if (n < 0) n = 0;
      h[x.id] = e.slice(0, n + 1).map(function (s, i) { return { quand: ago((n - i) * 1.5 + 0.1), etape: s, note: i === n && s === 'expedie' ? 'Livraison prévue jeudi.' : '', par: i ? 'youssef' : 'site', visible: 1 }; });
    });
  })();
  function fakeStats(j) {
    var pj = [], dj = [];
    for (var i = j - 1; i >= 0; i--) { var day = ago(i).slice(0, 10); pj.push({ jour: day, n: 60 + Math.round(40 * Math.sin(i / 3) + (i % 7 === 0 ? -25 : 0) + (j - i)) }); if (i % 3 === 0) dj.push({ jour: day, n: 1 + (i % 2) }); }
    var k = j / 30;
    function L(a) { return a.map(function (x) { return { cle: x[0], n: Math.max(1, Math.round(x[1] * k)) }; }); }
    return { ok: true, jours: j, totaux: { page: Math.round(2140 * k), produit: Math.round(860 * k), recherche: Math.round(212 * k), recherche_vide: Math.round(31 * k), whatsapp: Math.round(47 * k), panier: Math.round(64 * k) },
      pages_par_jour: pj, demandes_par_jour: dj,
      pages: L([['index.html', 610], ['infrastructure.html', 288], ['postes-de-travail.html', 254], ['serveurs.html', 177], ['portables.html', 160], ['configurateur.html', 98]]),
      produits: L([['Serveur Dell PowerEdge R760xs', 74], ['NAS Synology DS923+', 61], ['Portable Dell Pro 14', 55], ['HPE ProLiant DL380 Gen11', 42], ['Multifonction HP 4102fdw', 37]]),
      recherches: L([['r760', 22], ['synology', 19], ['onduleur', 15], ['latitude', 12], ['disque sas', 11], ['switch poe', 9]]),
      recherches_vides: L([['macbook', 7], ['fortinet', 6], ['toner 59a', 5], ['ipad', 4], ['cisco catalyst', 4], ['ecran 34 pouces', 3]]),
      demandes_produits: L([['Disque HPE 1,2 To SAS', 6], ['Portable Dell Pro 14', 4], ['Onduleur Eaton 5PX', 3]]),
      villes: L([['Casablanca', 9], ['Rabat', 5], ['Tanger', 4], ['Fès', 2], ['Marrakech', 2]]) };
  }
  function demo(a, q, body) {
    var r = { ok: true }, x;
    switch (a) {
      case 'etat': return { ok: true, installe: true, connecte: true, csrf: 'demo', moi: DB.moi };
      case 'tableau':
        var c = DB.clients, dm = DB.demandes, par = {};
        dm.forEach(function (x) { par[x.statut] = (par[x.statut] || 0) + 1; });
        r.clients_nouveaux = c.filter(function (x) { return x.statut === 'nouveau'; }).length; r.clients_valides = c.filter(function (x) { return x.statut === 'valide'; }).length;
        r.demandes_nouvelles = dm.filter(function (x) { return x.statut === 'nouveau'; }).length; r.demandes_30j = dm.length;
        r.en_cours = dm.filter(function (x) { return ['confirme', 'commande_fournisseur', 'expedie'].indexOf(x.statut) >= 0; }).length;
        r.ca_mois = dm.filter(function (x) { return x.statut === 'livre'; }).reduce(function (s, x) { return s + x.total; }, 0);
        r.a_encaisser = dm.filter(function (x) { return x.paiement === 'facture'; }).reduce(function (s, x) { return s + x.total; }, 0);
        r.avis_attente = DB.avis.filter(function (x) { return x.statut === 'nouveau'; }).length;
        r.par_statut = Object.keys(par).map(function (k) { return { statut: k, n: par[k] }; });
        r.relances = [{ quoi: 'demande', id: 4, titre: 'D-2026-00004 - Société Exemple SARL', raison: 'Demande sans réponse depuis plus de 24 h', depuis: ago(1.6) },
                      { quoi: 'demande', id: 3, titre: 'D-2026-00003 - Agence urbaine (exemple)', raison: 'Devis envoyé sans retour depuis 3 jours', depuis: ago(4) },
                      { quoi: 'client', id: 6, titre: 'Agence urbaine (exemple) (Karim Exemple)', raison: 'Compte pro en attente de validation', depuis: ago(1.4) }];
        r.derniers_clients = c.slice(0, 5); r.dernieres_demandes = dm.slice(0, 5); r.derniere_sauvegarde = DB.reglages.derniere_sauvegarde;
        return r;
      case 'clients': case 'demandes':
        r.lignes = DB[a].filter(function (x) {
          var s = q.statut, t = (q.q || '').toLowerCase();
          var okS = !s || (s === 'actives' ? ['livre', 'annule'].indexOf(x.statut) < 0 : x.statut === s);
          return okS && (!+q.commercial || +x.commercial_id === +q.commercial) && (!t || [x.ref, x.societe, x.nom, x.email, x.telephone, x.ice, x.ville].join(' ').toLowerCase().indexOf(t) >= 0);
        });
        r.lignes.forEach(function (x) { x.payable = x.total > 0 && x.paiement !== 'paye' && ['nouveau', 'annule'].indexOf(x.statut) < 0; x.lien_paiement = 'https://shop.dbt.ma/api/paiement.php?ref=' + x.ref + '&k=demo'; x.paiements = x.paiements || []; });
        r.etapes = ETAPES; r.odoo = true; r.cmi = true; return r;
      case 'historique': return { ok: true, historique: DB.historique[q.id] || [], lien_suivi: location.origin + '/suivi-commande.html?ref=' + DB.demandes.filter(function (x) { return x.id === +q.id; })[0].ref + '&k=demo' };
      case 'maj_client': case 'maj_demande':
        x = DB[a === 'maj_client' ? 'clients' : 'demandes'].filter(function (y) { return y.id === body.id; })[0];
        if (a === 'maj_demande' && body.statut && body.statut !== x.statut) DB.historique[x.id].push({ quand: new Date().toISOString(), etape: body.statut, note: body.note_client || '', par: 'youssef', visible: 1 });
        Object.keys(body).forEach(function (k) { if (['id', 'note_client', 'prevenir'].indexOf(k) < 0) x[k] = body[k]; });
        return r;
      case 'invitation':
        x = DB.clients.filter(function (y) { return y.id === body.id; })[0];
        if (x.statut !== 'valide') return { ok: false, erreur: "Validez d'abord le compte pro." };
        return { ok: true, lien: location.origin + '/espace-client.html?c=' + x.id + '&t=demo', email_envoye: !!body.email };
      case 'produits': return DB.produits ? { ok: true, lignes: DB.produits } : fetch('../api/catalogue-base.json').then(function (res) { return res.json(); }).then(function (l) {
        DB.produits = l.map(function (p) { return { id: p.id, sku: p.sku, nom: p.nom, marque: p.marque, categorie: p.categorie, univers: p.univers, prix_ttc: p.prix, prix_barre: p.barre, dispo: p.dispo, en_avant: p.avant ? 1 : 0, masque: 0, image: p.img }; });
        return { ok: true, lignes: DB.produits };
      }).catch(function () { DB.produits = []; return { ok: true, lignes: [] }; });
      case 'maj_produit': x = DB.produits.filter(function (y) { return y.id === body.id; })[0]; Object.assign(x, body); return r;
      case 'import_prix':
        var ok = 0, inc = [];
        String(body.csv).split(/\r?\n/).forEach(function (l) { var c = l.split(/[;,]/); if (c.length < 2 || !(parseFloat(String(c[1]).replace(/\s/g, '').replace(',', '.')) > 0)) return; var p = DB.produits.filter(function (y) { return y.sku && y.sku.toUpperCase() === c[0].trim().toUpperCase(); })[0]; if (p) { p.prix_ttc = Math.round(parseFloat(String(c[1]).replace(/\s/g, '').replace(',', '.')) * (+body.coef || 1) * 100) / 100; ok++; } else inc.push(c[0].trim()); });
        return { ok: true, mis_a_jour: ok, inconnus: inc };
      case 'stats': return fakeStats(+q.jours || 30);
      case 'avis': r.lignes = DB.avis; return r;
      case 'maj_avis': DB.avis.filter(function (y) { return y.id === body.id; })[0].statut = body.statut; return r;
      case 'commerciaux': r.lignes = DB.commerciaux.map(function (c) { return Object.assign({ nb_clients: DB.clients.filter(function (x) { return +x.commercial_id === c.id; }).length }, c); }); return r;
      case 'enr_commercial':
        if (!body.nom) return { ok: false, erreur: 'Indiquez le nom du commercial.' };
        if (body.whatsapp && !/^212[5-7]\d{8}$/.test(body.whatsapp)) return { ok: false, erreur: 'Numéro WhatsApp au format 2126XXXXXXXX (indicatif 212 sans le 0).' };
        if (body.id) Object.assign(DB.commerciaux.filter(function (x) { return x.id === body.id; })[0], body); else DB.commerciaux.push(Object.assign({}, body, { id: DB.commerciaux.length + 1 }));
        return r;
      case 'utilisateurs': r.lignes = DB.utilisateurs; return r;
      case 'enr_utilisateur':
        if (!body.identifiant) return { ok: false, erreur: "Indiquez l'identifiant." };
        if (body.role === 'commercial' && !body.commercial_id) return { ok: false, erreur: 'Rattachez ce compte à un commercial.' };
        if (!body.id && !body.mdp) return { ok: false, erreur: 'Choisissez un mot de passe pour ce nouveau compte.' };
        delete body.mdp;
        if (body.id) Object.assign(DB.utilisateurs.filter(function (x) { return x.id === body.id; })[0], body); else DB.utilisateurs.push(Object.assign({ a2f: 0 }, body, { id: DB.utilisateurs.length + 1 }));
        return r;
      case 'reglages': return Object.assign({ ok: true, moi: DB.moi }, DB.reglages);
      case 'enr_reglages': if (body.email_notification != null) DB.reglages.email_notification = body.email_notification; if (body.email != null) DB.moi.email = body.email; return r;
      case 'odoo_test': return { ok: true, version: '17.0', utilisateur: 'Youssef', societe: 'DIGITAL BOX TECHNOLOGIES' };
      case 'odoo_devis': case 'odoo_maj': case 'odoo_confirmer':
        x = DB.demandes.filter(function (y) { return y.id === body.id; })[0];
        Object.assign(x, { odoo_id: 40 + x.id, odoo_ref: 'S000' + (40 + x.id), odoo_etat: a === 'odoo_confirmer' ? 'sale' : (x.odoo_etat || 'draft'), lien_odoo: '#', lien_pdf: '#', lien_client: '#' });
        return Object.assign({ ok: true }, x);
      case 'envoyer_client': return r;
      case 'a2f_init': return { ok: true, secret: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://totp/DBT%20Backoffice%3Ayoussef?secret=JBSWY3DPEHPK3PXP&issuer=DIGITAL%20BOX%20TECHNOLOGIES' };
      case 'a2f_activer': if (!/^\d{6}$/.test(body.code)) return { ok: false, erreur: 'Code incorrect.' }; DB.moi.a2f = 1; return r;
      case 'a2f_desactiver': DB.moi.a2f = 0; return r;
    }
    return r;
  }

  // ------------------------------------------------------------------ appels API
  function api(a, q, body) {
    q = q || {};
    if (DEMO) return Promise.resolve(demo(a, q, body)).then(chk);
    var url = API + '?a=' + a + Object.keys(q).map(function (k) { return '&' + k + '=' + encodeURIComponent(q[k]); }).join('');
    var o = { credentials: 'same-origin', headers: { 'X-CSRF': CSRF } };
    if (body) { o.method = 'POST'; o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
    return fetch(url, o).then(function (r) {
      return r.json().catch(function () { throw { demo: true }; }).then(function (j) { if (r.status === 401 && ['connexion', 'code_a2f'].indexOf(a) < 0 && ME) { ME = null; showAuth('login'); } return j; });
    }).then(chk);
  }
  function chk(j) { if (!j.ok) throw { msg: j.erreur || 'Erreur.' }; return j; }
  function err(e) { toast((e && e.msg) || 'Erreur de connexion au serveur.', true); }

  // ------------------------------------------------------------------ authentification
  function showAuth(f) {
    $('#app').hidden = true; $('#auth').hidden = false;
    ['login', 'a2f', 'reset', 'install'].forEach(function (k) { $('#f-' + k).hidden = k !== f; });
    var i = $('#f-' + f + ' input'); if (i) i.focus();
  }
  function formErr(f, e) { var p = f.querySelector('.err'); p.textContent = (e && e.msg) || 'Erreur de connexion au serveur.'; p.hidden = false; var o = f.querySelector('.ok-m'); if (o) o.hidden = true; }
  function formOk(f, t) { var o = f.querySelector('.ok-m'); o.textContent = t; o.hidden = false; f.querySelector('.err').hidden = true; }
  function start() {
    var m = /[?&]reset=([^&]+)/.exec(location.search); if (m) RESET = decodeURIComponent(m[1]);
    api('etat').then(function (j) {
      CSRF = j.csrf;
      if (RESET) return showAuth('reset');
      if (j.connecte) { ME = j.moi; return enter(); }
      showAuth(!j.installe ? 'install' : j.a2f_attendu ? 'a2f' : 'login');
    }).catch(function (e) {
      if (e && e.demo) { DEMO = true; CSRF = 'demo'; ME = DB.moi; $('#demo').hidden = false; enter(); }
      else showAuth('login');
    });
  }
  $('#f-login').addEventListener('submit', function (ev) {
    ev.preventDefault(); var f = ev.target, fd = new FormData(f);
    api('connexion', null, { utilisateur: fd.get('utilisateur'), mdp: fd.get('mdp') }).then(function (j) {
      f.reset(); if (j.a2f) return showAuth('a2f'); CSRF = j.csrf; return api('etat').then(function (e) { CSRF = e.csrf; ME = e.moi; enter(); });
    }).catch(function (e) { formErr(f, e); });
  });
  $('#forgot').addEventListener('click', function () {
    var f = $('#f-login'), u = f.utilisateur.value.trim();
    if (!u) { f.utilisateur.focus(); return formErr(f, { msg: "Saisissez votre nom d'utilisateur ou votre e-mail, puis cliquez à nouveau." }); }
    api('oubli', null, { utilisateur: u }).then(function () { formOk(f, "Si un e-mail est associé à ce compte, un lien de réinitialisation vient d'être envoyé (valable 1 heure)."); }).catch(function (e) { formErr(f, e); });
  });
  $('#f-a2f').addEventListener('submit', function (ev) {
    ev.preventDefault(); var f = ev.target;
    api('code_a2f', null, { code: f.code.value.replace(/\s/g, '') }).then(function (j) { CSRF = j.csrf; return api('etat'); }).then(function (e) { CSRF = e.csrf; ME = e.moi; f.reset(); enter(); }).catch(function (e) { formErr(f, e); });
  });
  $('#f-reset').addEventListener('submit', function (ev) {
    ev.preventDefault(); var f = ev.target;
    if (f.mdp.value !== f.mdp2.value) return formErr(f, { msg: 'Les deux mots de passe ne correspondent pas.' });
    api('reinitialiser', null, { jeton: RESET, mdp: f.mdp.value }).then(function () {
      RESET = ''; history.replaceState(null, '', location.pathname); showAuth('login'); formOk($('#f-login'), 'Mot de passe enregistré. Connectez-vous.');
    }).catch(function (e) { formErr(f, e); });
  });
  $('#f-install').addEventListener('submit', function (ev) {
    ev.preventDefault(); var f = ev.target, fd = new FormData(f);
    if (fd.get('mdp') !== fd.get('mdp2')) return formErr(f, { msg: 'Les deux mots de passe ne correspondent pas.' });
    api('installer', null, { cle: fd.get('cle'), utilisateur: fd.get('utilisateur'), email: fd.get('email'), mdp: fd.get('mdp') })
      .then(function () { return api('etat'); }).then(function (e) { CSRF = e.csrf; ME = e.moi; enter(); }).catch(function (e) { formErr(f, e); });
  });
  $('#logout').addEventListener('click', function () { if (DEMO) return toast('Mode démonstration.'); api('deconnexion').then(function () { location.reload(); }); });

  function enter() {
    $('#auth').hidden = true; $('#app').hidden = false;
    $$('.nav [data-admin]').forEach(function (b) { b.hidden = !admin(); });
    $('#who').textContent = (ME.nom || ME.identifiant) + (admin() ? ', administrateur' : ', commercial');
    api('commerciaux').then(function (j) { COMS = j.lignes; go(V); }).catch(err);
  }

  // ------------------------------------------------------------------ navigation
  var VIEWS = {};
  $$('.nav button').forEach(function (b) { b.addEventListener('click', function () { go(b.dataset.v); }); });
  function go(v) {
    if (!VIEWS[v] || ($('.nav [data-v="' + v + '"]') || {}).hidden) v = 'tableau';
    V = v; $$('.nav button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === v); });
    $('#main').innerHTML = '<p class="mu load">Chargement...</p>'; window.scrollTo(0, 0);
    VIEWS[v](); badges();
  }
  function badges() {
    api('tableau').then(function (j) {
      [['#b-clients', j.clients_nouveaux], ['#b-demandes', j.demandes_nouvelles], ['#b-avis', j.avis_attente]].forEach(function (x) { var e = $(x[0]); e.textContent = x[1]; e.hidden = !x[1]; });
    }).catch(function () {});
  }
  document.addEventListener('click', function (e) {
    var g = e.target.closest('[data-go]'); if (g) { if (FILT[g.dataset.go]) FILT[g.dataset.go] = { statut: g.dataset.st || '', q: '', commercial: '' }; go(g.dataset.go); return; }
    var o = e.target.closest('[data-open]'); if (o) { openRow(o.dataset.open, +o.dataset.id); return; }
    var c = e.target.closest('[data-copy]'); if (c) { copy(c.dataset.copy); return; }
    if (e.target.closest('[data-close]')) closeDr();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDr();
    var r = e.target.closest && e.target.closest('tr[data-open]'); if (r && e.key === 'Enter') openRow(r.dataset.open, +r.dataset.id);
  });
  function head(t, intro, right) { return '<header class="mh"><h1>' + t + '</h1>' + (right || '') + '</header>' + (intro ? '<p class="mu intro">' + intro + '</p>' : ''); }

  // ------------------------------------------------------------------ tableau de bord
  VIEWS.tableau = function () {
    api('tableau').then(function (j) {
      var k = [['demandes', j.demandes_nouvelles, 'demandes à traiter', 'nouveau', 'hot'], ['demandes', j.en_cours, 'commandes en cours de livraison', 'actives', ''],
               ['demandes', money(j.ca_mois) || '0 DH', 'livré ce mois-ci', 'livre', ''], ['demandes', money(j.a_encaisser) || '0 DH', 'facturé, à encaisser', '', ''],
               ['clients', j.clients_nouveaux, 'comptes pro à valider', 'nouveau', j.clients_nouveaux ? 'hot' : '']];
      var tot = (j.par_statut || []).reduce(function (s, x) { return s + +x.n; }, 0), ps = {};
      (j.par_statut || []).forEach(function (x) { ps[x.statut] = +x.n; });
      var pipe = Object.keys(ETAPES).filter(function (s) { return ps[s]; });
      $('#main').innerHTML = head('Tableau de bord', '') +
        '<div class="kpis">' + k.map(function (x) { return '<button class="kpi ' + x[4] + '" data-go="' + x[0] + '" data-st="' + x[3] + '"><b>' + x[1] + '</b><span>' + x[2] + '</span></button>'; }).join('') + '</div>' +
        '<section class="card rel"><div class="ch"><h2>À relancer' + (j.relances.length ? ' <b class="bdg">' + j.relances.length + '</b>' : '') + '</h2></div>' +
        (j.relances.length ? '<ul class="mini">' + j.relances.map(function (r) { return '<li data-open="' + (r.quoi === 'client' ? 'clients' : 'demandes') + '" data-id="' + r.id + '"><span><b>' + esc(r.titre) + '</b><small>' + esc(r.raison) + '</small></span><span class="mu sm">' + d(r.depuis, 1) + '</span></li>'; }).join('') + '</ul>'
          : '<p class="mu">Rien à relancer : toutes les demandes ont reçu une réponse.</p>') + '<p class="mu sm">Un e-mail récapitulatif part chaque matin si la tâche planifiée est activée (Réglages).</p></section>' +
        (tot ? '<section class="card"><div class="ch"><h2>Où en sont les demandes</h2><button class="lk" data-go="demandes" data-st="">Tout voir</button></div><div class="pipe">' +
          pipe.map(function (s) { return '<button class="pp pp-' + s + '" style="flex:' + ps[s] + '" data-go="demandes" data-st="' + s + '" title="' + esc(ETAPES[s]) + '"><b>' + ps[s] + '</b><span>' + esc(ETAPES[s]) + '</span></button>'; }).join('') + '</div></section>' : '') +
        '<div class="two"><section class="card"><div class="ch"><h2>Dernières demandes</h2><button class="lk" data-go="demandes" data-st="">Tout voir</button></div>' +
        (j.dernieres_demandes.length ? '<ul class="mini">' + j.dernieres_demandes.map(function (c) { return '<li data-open="demandes" data-id="' + c.id + '"><span><b>' + esc(c.ref || '#' + c.id) + ' - ' + esc(c.societe || c.nom) + '</b><small>' + esc(DT[c.type] || c.type) + ', ' + d(c.cree_le) + (+c.total ? ', ' + money(c.total) : '') + '</small></span>' + pill(c.statut) + '</li>'; }).join('') + '</ul>' : '<p class="mu">Aucune demande pour le moment.</p>') +
        '</section><section class="card"><div class="ch"><h2>Dernières inscriptions</h2><button class="lk" data-go="clients" data-st="">Tout voir</button></div>' +
        (j.derniers_clients.length ? '<ul class="mini">' + j.derniers_clients.map(function (c) { return '<li data-open="clients" data-id="' + c.id + '"><span><b>' + esc(c.societe) + '</b><small>' + esc(c.nom) + (c.ville ? ', ' + esc(c.ville) : '') + '</small></span>' + pill(c.statut, CST) + '</li>'; }).join('') + '</ul>' : '<p class="mu">Aucune inscription pour le moment.</p>') +
        '</section></div>' +
        '<section class="card wa-card"><div class="ch"><h2>Numéros WhatsApp du site</h2>' + (admin() ? '<button class="lk" data-go="commerciaux">Modifier les numéros</button>' : '') + '</div><ul class="mini">' +
        COMS.map(function (c) { return '<li data-go="commerciaux"><span><b>' + esc(UNI[c.univers]) + '</b><small>' + esc(c.nom) + (+c.actif ? '' : ' (inactif)') + '</small></span><span class="num">' + (c.whatsapp ? '+' + esc(c.whatsapp) : 'non renseigné') + '</span></li>'; }).join('') + '</ul></section>';
    }).catch(err);
  };

  // ------------------------------------------------------------------ listes : commandes et comptes pro
  var FILT = { clients: { statut: 'nouveau', q: '', commercial: '' }, demandes: { statut: 'actives', q: '', commercial: '' } }, ROWS = {};
  function liste(t) {
    var f = FILT[t], cl = t === 'clients';
    var sts = cl ? [['nouveau', 'À valider'], ['valide', 'Validés'], ['refuse', 'Refusés'], ['archive', 'Archivés'], ['', 'Tous']]
                 : [['actives', 'En cours'], ['nouveau', 'Nouvelles'], ['devis_envoye', 'Devis envoyé'], ['confirme', 'Confirmées'], ['commande_fournisseur', 'Chez le distributeur'], ['expedie', 'Expédiées'], ['livre', 'Livrées'], ['annule', 'Annulées'], ['', 'Toutes']];
    $('#main').innerHTML = head(cl ? 'Comptes pro' : 'Commandes et devis',
      cl ? 'Inscriptions reçues depuis la page Compte pro. Validez le compte, fixez la remise, puis envoyez au client son lien d\'accès à l\'espace client.'
         : 'Commandes, demandes de prix et configurations envoyées depuis le site. Faites avancer chaque demande d\'étape en étape : le client suit l\'avancement en ligne.',
      '<a class="bt bl" href="' + dl('export&t=' + t) + '" data-dl>Exporter (CSV)</a>') +
      '<div class="filters"><div class="chips">' + sts.map(function (s) { return '<button data-s="' + s[0] + '" class="' + (f.statut === s[0] ? 'on' : '') + '">' + s[1] + '</button>'; }).join('') + '</div>' +
      '<input type="search" id="fq" placeholder="Rechercher : ' + (cl ? '' : 'référence, ') + 'société, nom, e-mail, ICE, ville" value="' + esc(f.q) + '">' +
      (admin() ? '<select id="fc"><option value="">Tous les commerciaux</option>' + COMS.map(function (c) { return '<option value="' + c.id + '"' + (+f.commercial === +c.id ? ' selected' : '') + '>' + esc(c.nom) + '</option>'; }).join('') + '</select>' : '') + '</div>' +
      '<div class="tbl-w"><table class="tbl"><thead><tr>' + (cl ? '<th>Inscrit le</th><th>Organisme</th><th>Contact</th><th>Ville</th><th>Remise</th><th>Commercial</th><th>Statut</th>'
                                                              : '<th>Référence</th><th>Client</th><th>Type</th><th>Montant</th><th>Paiement</th><th>Commercial</th><th>Étape</th>') +
      '</tr></thead><tbody id="tb"><tr><td colspan="7" class="mu">Chargement...</td></tr></tbody></table></div>';
    $('#main .chips').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { f.statut = b.dataset.s; liste(t); } });
    var tm; $('#fq').addEventListener('input', function (e) { clearTimeout(tm); tm = setTimeout(function () { f.q = e.target.value; load(t); }, 250); });
    if ($('#fc')) $('#fc').addEventListener('change', function (e) { f.commercial = e.target.value; load(t); });
    load(t);
  }
  VIEWS.demandes = function () { liste('demandes'); };
  VIEWS.clients = function () { liste('clients'); };
  function load(t) {
    var cl = t === 'clients';
    api(t, FILT[t]).then(function (j) {
      ROWS[t] = j.lignes; if (j.etapes) ETAPES = j.etapes; if (t === 'demandes') { ODOO = !!j.odoo; CMI = !!j.cmi; }
      $('#tb').innerHTML = j.lignes.length ? j.lignes.map(function (r) {
        return '<tr data-open="' + t + '" data-id="' + r.id + '" tabindex="0">' + (cl
          ? '<td>' + d(r.cree_le, 1) + '</td><td><b>' + esc(r.societe) + '</b><small>' + esc(TYP[r.type] || r.type) + (r.ice ? ', ICE ' + esc(r.ice) : '') + '</small></td><td>' + esc(r.nom) + '<small>' + esc(r.email) + '</small></td><td>' + esc(r.ville) + '</td>' +
            '<td>' + (+r.remise ? '<b>' + (+r.remise) + ' %</b>' : '<span class="mu">0 %</span>') + (+r.actif_espace ? '<small>Espace client actif</small>' : '') + '</td><td>' + esc(com(r.commercial_id)) + '</td><td>' + pill(r.statut, CST) + '</td>'
          : '<td><b>' + esc(r.ref || '#' + r.id) + '</b><small>' + d(r.cree_le) + '</small></td><td>' + esc(r.societe || r.nom) + '<small>' + esc(r.ville) + '</small></td><td>' + esc(DT[r.type] || r.type) + (r.fichier ? '<small class="bc">Bon de commande joint</small>' : '') + '</td>' +
            '<td>' + (money(r.total) || '<span class="mu">à chiffrer</span>') + '</td><td>' + pill(r.paiement || 'en_attente', PAY, 'pay') + '</td><td>' + esc(com(r.commercial_id)) + '</td><td>' + pill(r.statut) + '</td>') + '</tr>';
      }).join('') : '<tr><td colspan="7" class="empty">Aucun résultat pour ces filtres.</td></tr>';
    }).catch(err);
  }

  // ------------------------------------------------------------------ fiches détaillées
  function openRow(t, id) {
    var r = (ROWS[t] || []).filter(function (x) { return +x.id === id; })[0];
    if (!r) { return api(t, {}).then(function (j) { ROWS[t] = j.lignes; if (j.lignes.some(function (x) { return +x.id === id; })) openRow(t, id); }).catch(err); }
    (t === 'clients' ? ficheClient : ficheDemande)(r);
    $('#drawer').hidden = false; document.body.classList.add('lock'); $('.dr-x').focus();
  }
  function closeDr() { $('#drawer').hidden = true; document.body.classList.remove('lock'); }
  function contact(r, msg) {
    var tel = wa(r.telephone);
    return '<div class="qa">' + (tel ? '<a class="bt bwa" target="_blank" rel="noopener" href="https://wa.me/' + tel + '?text=' + encodeURIComponent(msg) + '">WhatsApp</a>' : '') +
      (r.telephone ? '<a class="bt bl" href="tel:' + esc(String(r.telephone).replace(/\s/g, '')) + '">Appeler</a>' : '') + (r.email ? '<a class="bt bl" href="mailto:' + esc(r.email) + '">E-mail</a>' : '') + '</div>';
  }
  function kv(f) { return '<dl class="kv">' + f.filter(function (x) { return x[1]; }).map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join('') + '</dl>'; }
  function after() { closeDr(); go(V); }

  function ficheDemande(r) {
    var steps = Object.keys(ETAPES), lg = r.lignes || [];
    $('#dr-c').innerHTML = '<p class="dr-k">' + esc(DT[r.type] || r.type) + ' ' + pill(r.statut) + ' ' + pill(r.paiement || 'en_attente', PAY, 'pay') + '</p><h2 id="dr-t">' + esc(r.ref || '#' + r.id) + ' - ' + esc(r.societe || r.nom) + '</h2>' +
      contact(r, 'Bonjour ' + r.nom + ', ici DIGITAL BOX TECHNOLOGIES, au sujet de votre demande ' + (r.ref || '') + '.') +
      kv([['Client', r.nom], ['Société', r.societe], ['ICE', r.ice], ['E-mail', r.email], ['Téléphone', r.telephone], ['Ville', r.ville], ['Univers', univ(r.univers)], ['Reçue le', d(r.cree_le)], ['Compte pro', r.client_id ? 'Oui, connecté à l\'espace client' : '']]) +
      (r.fichier ? '<a class="bt bl fbc" href="' + (DEMO ? '#' : API + '?a=fichier&id=' + r.id) + '" target="_blank" rel="noopener" data-dl>Ouvrir le bon de commande joint</a>' : '') +
      (lg.length ? '<h3>Articles</h3><table class="lg"><tbody>' + lg.map(function (l) { return '<tr><td>' + esc(l.qte) + ' x</td><td>' + esc(l.nom) + (l.sku ? '<small>Réf. ' + esc(l.sku) + '</small>' : '') + '</td><td>' + (+l.prix ? money(l.prix * l.qte) : '<span class="mu">à chiffrer</span>') + '</td></tr>'; }).join('') + '</tbody></table>' : '') +
      '<details' + (lg.length ? '' : ' open') + '><summary>Message complet</summary><pre class="pre">' + esc(r.contenu) + '</pre></details>' +
      '<h3>Devis et paiement</h3><div class="box op" id="d-op"></div>' + '<h3>Avancement</h3><ol class="tl" id="d-hist"><li class="mu">Chargement...</li></ol><div class="suivi" id="d-suivi"></div>' +
      '<div class="box"><label class="fl">Passer à l\'étape<select id="d-st">' + steps.map(function (s) { return '<option value="' + s + '"' + (s === r.statut ? ' selected' : '') + '>' + esc(ETAPES[s]) + '</option>'; }).join('') + '</select></label>' +
      '<label class="fl">Message pour le client (affiché sur sa page de suivi)<textarea id="d-nc" rows="2" placeholder="Exemple : livraison prévue jeudi matin."></textarea></label>' +
      '<label class="ck"><input type="checkbox" id="d-prev" checked> Prévenir le client par e-mail</label></div>' +
      '<div class="g2"><label class="fl">Montant TTC (DH)<input id="d-tot" type="number" min="0" step="0.01" value="' + (+r.total || '') + '"></label>' +
      '<label class="fl">Paiement<select id="d-pay">' + opts(PAY, r.paiement || 'en_attente') + '</select></label></div>' +
      (admin() ? '<label class="fl">Commercial attribué<select id="d-com">' + comOpts(r.commercial_id) + '</select></label>' : '') +
      '<label class="fl">Notes internes<textarea id="d-notes" rows="3" placeholder="Échanges, prix fournisseur, prochaine action...">' + esc(r.notes) + '</textarea></label>' +
      '<div class="dr-a"><button class="bt bp" id="d-save">Enregistrer</button><button class="bt bl" data-close>Fermer</button></div>' +
      '<p class="mu sm">Devis PDF : connexion à Odoo prévue à l\'étape suivante du projet.</p>';
    api('historique', { id: r.id }).then(function (j) {
      $('#d-hist').innerHTML = j.historique.map(function (h) { var ev = h.note && (h.par === 'odoo' || h.par === 'cmi' || !+h.visible); return '<li class="' + (h.etape === 'annule' ? 'ko' : ev ? 'ev' : '') + '"><b>' + esc(ev ? h.note : (ETAPES[h.etape] || h.etape)) + '</b><small>' + d(h.quand) + ', par ' + esc(({ odoo: 'Odoo', cmi: 'CMI', site: 'le site', client: 'le client' })[h.par] || h.par) + '</small>' + (!ev && h.note ? '<p>' + esc(h.note) + '</p>' : '') + '</li>'; }).join('') || '<li class="mu">Aucun historique.</li>';
      var msg = 'Bonjour ' + r.nom + ', suivez votre demande ' + r.ref + ' en ligne : ' + j.lien_suivi;
      $('#d-suivi').innerHTML = '<span>Lien de suivi client</span><button class="bt bl sm" data-copy="' + esc(j.lien_suivi) + '">Copier le lien</button>' +
        (wa(r.telephone) ? '<a class="bt bwa sm" target="_blank" rel="noopener" href="https://wa.me/' + wa(r.telephone) + '?text=' + encodeURIComponent(msg) + '">Envoyer par WhatsApp</a>' : '');
    }).catch(function () { $('#d-hist').innerHTML = '<li class="mu">Historique indisponible.</li>'; });
    op(r);
    $('#d-save').addEventListener('click', function () {
      var b = { id: r.id, notes: $('#d-notes').value, total: +$('#d-tot').value || 0, paiement: $('#d-pay').value };
      if ($('#d-com')) b.commercial_id = +$('#d-com').value || null;
      if ($('#d-st').value !== r.statut) { b.statut = $('#d-st').value; b.note_client = $('#d-nc').value.trim(); b.prevenir = $('#d-prev').checked ? 1 : 0; }
      api('maj_demande', null, b).then(function () { toast(b.statut ? 'Étape mise à jour' + (b.prevenir ? ', client prévenu.' : '.') : 'Enregistré.'); after(); }).catch(err);
    });
  }

  function op(r) {
    var tel = wa(r.telephone), h = '';
    if (!ODOO) h += '<p class="mu">' + (admin() ? 'Connectez Odoo dans Réglages pour créer le devis PDF de cette demande en un clic.' : 'Odoo n\'est pas encore connecté.') + '</p>';
    else if (!r.odoo_id) h += '<p>Créez le devis dans Odoo : client, articles et quantités sont repris automatiquement.</p><div class="qa"><button class="bt bp sm" data-o="odoo_devis">Créer le devis dans Odoo</button></div>';
    else {
      h += '<p><b>Devis ' + esc(r.odoo_ref) + '</b> <span class="st">' + esc(OET[r.odoo_etat] || r.odoo_etat) + '</span>' + (+r.total ? ' ' + money(r.total) + ' TTC' : '') + '</p><div class="qa">' +
        '<a class="bt bl sm" href="' + esc(r.lien_odoo) + '" target="_blank" rel="noopener">Ouvrir dans Odoo</a>' +
        (r.lien_pdf ? '<a class="bt bl sm" href="' + esc(r.lien_pdf) + '" target="_blank" rel="noopener">Devis PDF</a>' : '') +
        '<button class="bt bl sm" data-o="odoo_maj">Actualiser depuis Odoo</button>' +
        (r.odoo_etat === 'draft' || r.odoo_etat === 'sent' ? '<button class="bt bl sm" data-o="odoo_confirmer">Confirmer la commande dans Odoo</button>' : '') + '</div>' +
        (r.lien_client ? '<div class="qa"><button class="bt bp sm" data-env="devis">Envoyer le devis par e-mail</button>' +
          (tel ? '<a class="bt bwa sm" target="_blank" rel="noopener" href="https://wa.me/' + tel + '?text=' + encodeURIComponent('Bonjour ' + r.nom + ', voici votre devis ' + r.odoo_ref + ' DIGITAL BOX TECHNOLOGIES, à consulter et accepter en ligne : ' + r.lien_client) + '">Devis par WhatsApp</a>' : '') + '</div>' : '');
    }
    h += '<hr>';
    if (r.paiement === 'paye') h += '<p class="ok-t"><b>Commande payée.</b></p>';
    else if (!CMI) h += '<p class="mu">Paiement par carte : à activer dans Réglages une fois le contrat CMI signé.</p>';
    else if (!r.payable) h += '<p class="mu">Paiement par carte : indiquez le montant TTC et passez la demande au moins à « Devis envoyé » pour proposer le lien de paiement.</p>';
    else h += '<p>Lien de paiement par carte (CMI) pour <b>' + money(r.total) + '</b> :</p><div class="qa"><button class="bt bp sm" data-env="paiement">Envoyer par e-mail</button>' +
      (tel ? '<a class="bt bwa sm" target="_blank" rel="noopener" href="https://wa.me/' + tel + '?text=' + encodeURIComponent('Bonjour ' + r.nom + ', vous pouvez régler votre commande ' + r.ref + ' (' + money(r.total) + ') par carte bancaire, paiement sécurisé : ' + r.lien_paiement) + '">Envoyer par WhatsApp</a>' : '') +
      '<button class="bt bl sm" data-copy="' + esc(r.lien_paiement) + '">Copier le lien</button></div>';
    if ((r.paiements || []).length) h += '<ul class="pays">' + r.paiements.map(function (p) { return '<li><span>' + d(p.cree_le) + '</span><b>' + money(p.montant) + '</b><span class="st st-' + (p.statut === 'paye' ? 'livre' : p.statut === 'refuse' ? 'annule' : 'nouveau') + '">' + ({ paye: 'Payé', refuse: 'Refusé', initie: 'Abandonné ou en cours' })[p.statut] + '</span>' + (p.carte ? '<small>' + esc(p.carte) + '</small>' : '') + '</li>'; }).join('') + '</ul>';
    var box = $('#d-op'); box.innerHTML = h;
    $$('[data-o]', box).forEach(function (b) { b.addEventListener('click', function () {
      b.disabled = true; b.textContent = 'Connexion à Odoo...';
      api(b.dataset.o, null, { id: r.id }).then(function (j) { Object.assign(r, j); if (+j.total) $('#d-tot').value = j.total; toast(b.dataset.o === 'odoo_devis' ? 'Devis ' + j.odoo_ref + ' créé dans Odoo.' : 'Odoo à jour.'); op(r); load('demandes'); })
        .catch(function (e) { err(e); op(r); });
    }); });
    $$('[data-env]', box).forEach(function (b) { b.addEventListener('click', function () {
      var q = { id: r.id }; q[b.dataset.env] = 1;
      api('envoyer_client', null, q).then(function () { toast('E-mail envoyé à ' + r.email + '.'); }).catch(err);
    }); });
  }

  function ficheClient(r) {
    $('#dr-c').innerHTML = '<p class="dr-k">Compte pro n° ' + r.id + ' ' + pill(r.statut, CST) + '</p><h2 id="dr-t">' + esc(r.societe) + '</h2>' +
      contact(r, 'Bonjour ' + r.nom + ', ici DIGITAL BOX TECHNOLOGIES. Votre compte pro est validé, je suis votre interlocuteur commercial.') +
      kv([['Type', TYP[r.type] || r.type], ['ICE', r.ice], ['Contact', r.nom], ['Fonction', r.fonction], ['E-mail', r.email], ['Téléphone', r.telephone], ['Ville', r.ville], ['Univers', univ(r.univers)], ['Inscrit le', d(r.cree_le)], ['Dernière visite', r.dernier_acces ? d(r.dernier_acces) : '']]) +
      (r.message ? '<h3>Besoin exprimé</h3><p class="pre">' + esc(r.message) + '</p>' : '') +
      '<h3>Conditions</h3><div class="g2"><label class="fl">Remise sur les prix publics (%)<input id="c-rem" type="number" min="0" max="60" step="0.5" value="' + (+r.remise || 0) + '"><small>Appliquée automatiquement quand le client est connecté.</small></label>' +
      (admin() ? '<label class="fl">Commercial attribué<select id="c-com">' + comOpts(r.commercial_id) + '</select></label>' : '<span></span>') + '</div>' +
      '<label class="fl">Notes internes<textarea id="c-notes" rows="3" placeholder="Échanges, conditions négociées, prochaine action...">' + esc(r.notes) + '</textarea></label>' +
      '<h3>Espace client</h3><div class="box" id="c-esp">' + (r.statut !== 'valide' ? '<p class="mu">Validez d\'abord le compte pour envoyer au client son lien d\'accès.</p>'
        : '<p>' + (+r.actif_espace ? 'Le client a activé son espace. Un nouveau lien lui permet de changer son mot de passe.' : 'Le client n\'a pas encore activé son espace client.') + '</p>' +
          '<div class="qa"><button class="bt bp sm" id="c-inv">Créer le lien d\'accès</button><button class="bt bl sm" id="c-invm">Créer et envoyer par e-mail</button></div><div id="c-lien"></div>') + '</div>' +
      '<div class="dr-a">' + [['valide', 'Valider le compte', 'bp'], ['refuse', 'Refuser', 'bl'], ['archive', 'Archiver', 'bl']].map(function (a) { return '<button class="bt ' + a[2] + '" data-st="' + a[0] + '"' + (r.statut === a[0] ? ' disabled' : '') + '>' + a[1] + '</button>'; }).join('') +
      '<button class="bt bl" id="c-save">Enregistrer</button></div>';
    function save(extra) {
      var b = Object.assign({ id: r.id, notes: $('#c-notes').value, remise: +$('#c-rem').value || 0 }, extra || {});
      if ($('#c-com')) b.commercial_id = +$('#c-com').value || null;
      return api('maj_client', null, b).then(function () { Object.assign(r, b); });
    }
    $('#c-save').addEventListener('click', function () { save().then(function () { toast('Enregistré.'); after(); }).catch(err); });
    $$('.dr-a [data-st]').forEach(function (b) { b.addEventListener('click', function () { save({ statut: b.dataset.st }).then(function () { toast(b.dataset.st === 'valide' ? 'Compte validé. Envoyez-lui maintenant son lien d\'accès.' : 'Enregistré.'); if (b.dataset.st === 'valide') ficheClient(r); else after(); }).catch(err); }); });
    function inv(mail) {
      api('invitation', null, { id: r.id, email: mail ? 1 : 0 }).then(function (j) {
        var msg = 'Bonjour ' + r.nom + ', votre compte pro DIGITAL BOX TECHNOLOGIES est validé. Créez votre mot de passe pour voir vos prix pro et suivre vos commandes (lien valable 7 jours) : ' + j.lien;
        $('#c-lien').innerHTML = '<input readonly value="' + esc(j.lien) + '" aria-label="Lien d\'accès"><div class="qa"><button class="bt bl sm" data-copy="' + esc(j.lien) + '">Copier</button>' +
          (wa(r.telephone) ? '<a class="bt bwa sm" target="_blank" rel="noopener" href="https://wa.me/' + wa(r.telephone) + '?text=' + encodeURIComponent(msg) + '">Envoyer par WhatsApp</a>' : '') + '</div>' +
          (mail ? '<p class="sm ' + (j.email_envoye ? 'ok-t' : 'ko-t') + '">' + (j.email_envoye ? 'E-mail envoyé à ' + esc(r.email) + '.' : 'L\'e-mail n\'a pas pu partir : envoyez le lien par WhatsApp.') + '</p>' : '');
      }).catch(err);
    }
    if ($('#c-inv')) { $('#c-inv').addEventListener('click', function () { inv(false); }); $('#c-invm').addEventListener('click', function () { inv(true); }); }
  }

  // ------------------------------------------------------------------ catalogue et prix
  var PF = { u: '', q: '', m: '' }, PROD = [];
  VIEWS.produits = function () {
    $('#main').innerHTML = head('Catalogue et prix', 'Les prix, la disponibilité et la mise en avant modifiés ici s\'affichent sur le site sans republier. Laissez le prix à 0 pour afficher « Prix sur demande ».',
      '<span class="hr"><a class="bt bl" href="' + dl('export&t=produits') + '" data-dl>Exporter (CSV)</a><a class="bt bl" href="' + dl('export&t=whatsapp') + '" data-dl>Catalogue WhatsApp / Meta</a></span>') +
      '<details class="card imp"><summary><b>Importer une liste de prix distributeur</b><span class="mu">Mise à jour en masse par référence fabricant</span></summary>' +
      '<p class="mu">Une ligne par article : <code>référence;prix;disponibilité</code>. La disponibilité est facultative (En stock, Sur commande, Rupture). Le coefficient permet d\'appliquer votre marge sur un prix d\'achat.</p>' +
      '<div class="g3"><label class="fl">Fichier CSV<input type="file" id="i-f" accept=".csv,.txt,text/csv"></label><label class="fl">Coefficient<input id="i-c" type="number" step="0.01" min="0.5" value="1"><small>1 = prix importés tels quels, 1,18 = +18 %.</small></label></div>' +
      '<label class="fl">Ou collez les lignes<textarea id="i-t" rows="5" placeholder="872479-B21;2460;En stock&#10;5PX1500IRT2UG2;10500"></textarea></label>' +
      '<div class="dr-a"><button class="bt bp" id="i-go">Importer les prix</button></div><div id="i-r"></div></details>' +
      '<div class="filters"><div class="chips" id="p-u">' + [['', 'Tout'], ['postes', 'Postes de travail'], ['infra', 'Infrastructure']].map(function (s) { return '<button data-s="' + s[0] + '" class="' + (PF.u === s[0] ? 'on' : '') + '">' + s[1] + '</button>'; }).join('') + '</div>' +
      '<div class="chips" id="p-m">' + [['', 'Tous'], ['sans', 'Sans prix'], ['avant', 'En avant'], ['masque', 'Masqués']].map(function (s) { return '<button data-s="' + s[0] + '" class="' + (PF.m === s[0] ? 'on' : '') + '">' + s[1] + '</button>'; }).join('') + '</div>' +
      '<input type="search" id="p-q" placeholder="Rechercher : nom, marque, référence" value="' + esc(PF.q) + '"></div>' +
      '<div class="tbl-w"><table class="tbl pt"><thead><tr><th>Article</th><th>Prix TTC</th><th>Prix barré</th><th>Disponibilité</th><th title="Affiché en page d\'accueil">En avant</th><th title="Retiré du site">Masqué</th></tr></thead><tbody id="p-tb"><tr><td colspan="6" class="mu">Chargement...</td></tr></tbody></table></div>';
    $('#p-u').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { PF.u = b.dataset.s; $$('#p-u button').forEach(function (x) { x.classList.toggle('on', x === b); }); drawP(); } });
    $('#p-m').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { PF.m = b.dataset.s; $$('#p-m button').forEach(function (x) { x.classList.toggle('on', x === b); }); drawP(); } });
    $('#p-q').addEventListener('input', function (e) { PF.q = e.target.value; drawP(); });
    $('#i-f').addEventListener('change', function (e) { var f = e.target.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { $('#i-t').value = rd.result; }; rd.readAsText(f); });
    $('#i-go').addEventListener('click', function () {
      var t = $('#i-t').value.trim(); if (!t) return toast('Choisissez un fichier ou collez des lignes.', true);
      api('import_prix', null, { csv: t, coef: +$('#i-c').value || 1 }).then(function (j) {
        $('#i-r').innerHTML = '<p class="ok-t"><b>' + j.mis_a_jour + ' article(s) mis à jour.</b></p>' + (j.inconnus.length ? '<p class="mu sm">Références absentes du catalogue : ' + esc(j.inconnus.join(', ')) + '</p>' : '');
        loadP();
      }).catch(err);
    });
    loadP();
  };
  function loadP() { api('produits').then(function (j) { PROD = j.lignes; drawP(); }).catch(err); }
  function drawP() {
    var q = PF.q.toLowerCase(), L = PROD.filter(function (p) {
      return (!PF.u || p.univers === PF.u) && (!q || [p.nom, p.marque, p.sku, p.categorie].join(' ').toLowerCase().indexOf(q) >= 0) &&
        (!PF.m || (PF.m === 'sans' && !(+p.prix_ttc)) || (PF.m === 'avant' && +p.en_avant) || (PF.m === 'masque' && +p.masque));
    });
    $('#p-tb').innerHTML = L.length ? L.map(function (p) {
      return '<tr data-pid="' + esc(p.id) + '" class="' + (+p.masque ? 'off' : '') + '"><td><b>' + esc(p.nom) + '</b><small>' + esc(p.marque) + (p.sku ? ', réf. ' + esc(p.sku) : '') + ', ' + esc(p.categorie) + '</small></td>' +
        '<td><input type="number" min="0" step="1" name="prix_ttc" value="' + (+p.prix_ttc || '') + '" placeholder="Sur demande" aria-label="Prix TTC" title="0 ou vide : prix sur demande"></td>' +
        '<td><input type="number" min="0" step="1" name="prix_barre" value="' + (+p.prix_barre || '') + '" aria-label="Prix barré"></td>' +
        '<td><select name="dispo" aria-label="Disponibilité">' + ['En stock', 'Sur commande', 'Rupture'].map(function (x) { return '<option' + (x === p.dispo ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></td>' +
        '<td class="c"><input type="checkbox" name="en_avant"' + (+p.en_avant ? ' checked' : '') + ' aria-label="En avant"></td><td class="c"><input type="checkbox" name="masque"' + (+p.masque ? ' checked' : '') + ' aria-label="Masqué"></td></tr>';
    }).join('') : '<tr><td colspan="6" class="empty">Aucun article pour ces filtres.</td></tr>';
  }
  document.addEventListener('change', function (e) {
    var tr = e.target.closest && e.target.closest('tr[data-pid]'); if (!tr) return;
    var p = PROD.filter(function (x) { return x.id === tr.dataset.pid; })[0]; if (!p) return;
    var b = { id: p.id, prix_ttc: +tr.querySelector('[name=prix_ttc]').value || 0, prix_barre: +tr.querySelector('[name=prix_barre]').value || 0, dispo: tr.querySelector('[name=dispo]').value,
              en_avant: tr.querySelector('[name=en_avant]').checked ? 1 : 0, masque: tr.querySelector('[name=masque]').checked ? 1 : 0 };
    if (b.prix_barre && b.prix_barre <= b.prix_ttc) toast('Le prix barré doit être supérieur au prix TTC pour s\'afficher.', true);
    api('maj_produit', null, b).then(function () { Object.assign(p, b); tr.classList.toggle('off', !!b.masque); tr.classList.add('saved'); setTimeout(function () { tr.classList.remove('saved'); }, 900); }).catch(err);
  });

  // ------------------------------------------------------------------ statistiques
  var SJ = 30;
  VIEWS.stats = function () {
    $('#main').innerHTML = head('Statistiques', 'Visites mesurées sans cookie ni outil externe. Les recherches sans résultat montrent les produits que vos visiteurs attendent et que le catalogue ne propose pas encore.',
      '<div class="chips" id="s-j">' + [7, 30, 90].map(function (j) { return '<button data-j="' + j + '" class="' + (SJ === j ? 'on' : '') + '">' + j + ' jours</button>'; }).join('') + '</div>') + '<div id="s-c"><p class="mu">Chargement...</p></div>';
    $('#s-j').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { SJ = +b.dataset.j; VIEWS.stats(); } });
    api('stats', { jours: SJ }).then(function (j) {
      var pm = {}; j.pages_par_jour.forEach(function (x) { pm[x.jour] = +x.n; });
      j.pages_par_jour = []; for (var i = j.jours - 1; i >= 0; i--) { var jr = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10); j.pages_par_jour.push({ jour: jr, n: pm[jr] || 0 }); }
      var t = j.totaux || {}, mx = Math.max.apply(null, [1].concat(j.pages_par_jour.map(function (x) { return +x.n; }))), dj = {};
      j.demandes_par_jour.forEach(function (x) { dj[x.jour] = +x.n; });
      var dem = j.demandes_par_jour.reduce(function (s, x) { return s + +x.n; }, 0);
      function top(titre, l, vide, cls) {
        var m = Math.max.apply(null, [1].concat(l.map(function (x) { return +x.n; })));
        return '<section class="card top ' + (cls || '') + '"><h2>' + titre + '</h2>' + (l.length ? '<ol>' + l.map(function (x) { return '<li><span>' + esc(x.cle) + '</span><b>' + nb(x.n) + '</b><i style="width:' + Math.round(100 * x.n / m) + '%"></i></li>'; }).join('') + '</ol>' : '<p class="mu">' + vide + '</p>') + '</section>';
      }
      $('#s-c').innerHTML = '<div class="kpis k6">' + [[t.page, 'pages vues'], [t.produit, 'fiches produit vues'], [t.recherche, 'recherches'], [t.panier, 'ajouts au panier'], [t.whatsapp, 'clics WhatsApp'], [dem, 'demandes reçues']].map(function (x) { return '<div class="kpi ks"><b>' + nb(x[0]) + '</b><span>' + x[1] + '</span></div>'; }).join('') + '</div>' +
        '<section class="card"><h2>Pages vues par jour</h2><div class="bars">' + j.pages_par_jour.map(function (x) { return '<span title="' + d(x.jour, 1) + ' : ' + x.n + ' pages' + (dj[x.jour] ? ', ' + dj[x.jour] + ' demande(s)' : '') + '" style="height:' + (x.n ? Math.max(3, Math.round(100 * x.n / mx)) : 1) + '%"' + (dj[x.jour] ? ' class="dm"' : '') + '></span>'; }).join('') + '</div>' +
        '<p class="mu sm"><i class="lg-d"></i> jour avec au moins une demande reçue</p></section>' +
        '<div class="two">' + top('Recherches sans résultat', j.recherches_vides, 'Aucune recherche infructueuse sur la période.', 'warn') + top('Recherches les plus fréquentes', j.recherches, 'Aucune recherche sur la période.') +
        top('Produits les plus consultés', j.produits, 'Pas encore de données.') + top('Produits les plus demandés', j.demandes_produits, 'Pas encore de demande.') +
        top('Pages les plus vues', j.pages, 'Pas encore de données.') + top('Villes des demandes', j.villes, 'Pas encore de demande.') + '</div>';
    }).catch(err);
  };

  // ------------------------------------------------------------------ avis clients
  var AF = 'nouveau';
  VIEWS.avis = function () {
    $('#main').innerHTML = head('Avis clients', 'Les avis déposés sur le site n\'apparaissent qu\'après votre validation.',
      '') + '<div class="filters"><div class="chips" id="a-f">' + [['nouveau', 'À modérer'], ['publie', 'Publiés'], ['refuse', 'Refusés'], ['', 'Tous']].map(function (s) { return '<button data-s="' + s[0] + '" class="' + (AF === s[0] ? 'on' : '') + '">' + s[1] + '</button>'; }).join('') + '</div></div><div class="avl" id="a-l"><p class="mu">Chargement...</p></div>';
    $('#a-f').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { AF = b.dataset.s; VIEWS.avis(); } });
    api('avis').then(function (j) {
      var L = j.lignes.filter(function (a) { return !AF || a.statut === AF; });
      $('#a-l').innerHTML = L.length ? L.map(function (a) {
        return '<article class="card av"><div class="av-h">' + stars(+a.note) + pill(a.statut, AST, 'av') + '<span class="mu sm">' + d(a.cree_le) + '</span></div>' +
          '<p class="av-t">' + esc(a.texte) + '</p><p class="mu sm"><b>' + esc(a.nom) + '</b>' + (a.societe ? ', ' + esc(a.societe) : '') + (a.ville ? ', ' + esc(a.ville) : '') + (a.produit ? '. Produit : ' + esc(a.produit) : '') + (a.email ? '. ' + esc(a.email) : '') + '</p>' +
          '<div class="qa">' + (a.statut !== 'publie' ? '<button class="bt bp sm" data-av="' + a.id + '" data-s="publie">Publier</button>' : '') + (a.statut !== 'refuse' ? '<button class="bt bl sm" data-av="' + a.id + '" data-s="refuse">Refuser</button>' : '') + (a.statut !== 'nouveau' ? '<button class="bt bl sm" data-av="' + a.id + '" data-s="nouveau">Remettre en attente</button>' : '') + '</div></article>';
      }).join('') : '<p class="card mu">Aucun avis dans cette liste.</p>';
      $$('#a-l [data-av]').forEach(function (b) { b.addEventListener('click', function () { api('maj_avis', null, { id: +b.dataset.av, statut: b.dataset.s }).then(function () { toast(b.dataset.s === 'publie' ? 'Avis publié sur le site.' : 'Avis mis à jour.'); VIEWS.avis(); badges(); }).catch(err); }); });
    }).catch(err);
  };

  // ------------------------------------------------------------------ commerciaux
  VIEWS.commerciaux = function () {
    var m = $('#main');
    api('commerciaux').then(function (j) {
      COMS = j.lignes;
      m.innerHTML = head('Commerciaux', 'Les visiteurs joignent sur WhatsApp le commercial de l\'univers consulté. Les nouveaux comptes pro et les demandes lui sont attribués automatiquement.', admin() ? '<button class="bt bp" id="c-add">Ajouter un commercial</button>' : '') +
        '<div class="coms">' + COMS.map(function (c) {
          return '<article class="card com' + (+c.actif ? '' : ' off') + '"><div><b>' + esc(c.nom) + '</b><span class="tag">' + esc(UNI[c.univers]) + '</span>' + (+c.actif ? '' : '<span class="tag">Inactif</span>') + '</div>' +
            '<p>WhatsApp : ' + (c.whatsapp ? '<span class="num">+' + esc(c.whatsapp) + '</span>' : '<em>non renseigné</em>') + '</p><p>E-mail : ' + esc(c.email || 'non renseigné') + '</p><p class="mu">' + c.nb_clients + ' client(s) attribué(s)</p>' +
            (admin() ? '<button class="bt bl" data-ed="' + c.id + '">Modifier</button>' : '') + '</article>';
        }).join('') + '</div>' + (admin() ? '<form class="card cf" id="cf" hidden><h2 id="cf-t">Nouveau commercial</h2><input type="hidden" name="cid">' +
        '<div class="g2"><label class="fl">Nom<input name="nom" required></label><label class="fl">Univers<select name="univers">' + opts(UNI, 'postes') + '</select></label>' +
        '<label class="fl">Numéro WhatsApp<input name="whatsapp" placeholder="2126XXXXXXXX" inputmode="numeric"><small>Indicatif 212 puis le numéro sans le 0.</small></label><label class="fl">E-mail (reçoit ses demandes et relances)<input name="email" type="email"></label></div>' +
        '<label class="ck"><input type="checkbox" name="actif" checked> Actif (affiché sur le site)</label><div class="dr-a"><button class="bt bp">Enregistrer</button><button type="button" class="bt bl" id="cf-x">Annuler</button></div></form>' : '');
      if (!admin()) return;
      var cf = $('#cf');
      function edit(c) {
        cf.hidden = false; $('#cf-t').textContent = c ? 'Modifier ' + c.nom : 'Nouveau commercial';
        cf.cid.value = c ? c.id : ''; cf.nom.value = c ? c.nom : ''; cf.univers.value = c ? c.univers : 'postes'; cf.whatsapp.value = c ? c.whatsapp : ''; cf.email.value = c ? c.email : ''; cf.actif.checked = c ? !!+c.actif : true;
        cf.scrollIntoView({ behavior: 'smooth' }); cf.nom.focus();
      }
      $('#c-add').addEventListener('click', function () { edit(null); });
      $('#cf-x').addEventListener('click', function () { cf.hidden = true; });
      $$('[data-ed]', m).forEach(function (b) { b.addEventListener('click', function () { edit(COMS.filter(function (c) { return +c.id === +b.dataset.ed; })[0]); }); });
      cf.addEventListener('submit', function (e) {
        e.preventDefault();
        api('enr_commercial', null, { id: +cf.cid.value || 0, nom: cf.nom.value.trim(), univers: cf.univers.value, whatsapp: wa(cf.whatsapp.value), email: cf.email.value.trim(), actif: cf.actif.checked ? 1 : 0 })
          .then(function () { toast('Commercial enregistré.'); VIEWS.commerciaux(); }).catch(err);
      });
    }).catch(err);
  };

  // ------------------------------------------------------------------ utilisateurs
  VIEWS.utilisateurs = function () {
    api('utilisateurs').then(function (j) {
      var U = j.lignes;
      $('#main').innerHTML = head('Utilisateurs', 'Un compte par personne. Un commercial ne voit que ses propres clients et demandes ; l\'administrateur voit tout et gère le catalogue, les avis et les réglages.', '<button class="bt bp" id="u-add">Ajouter un utilisateur</button>') +
        '<div class="tbl-w"><table class="tbl"><thead><tr><th>Utilisateur</th><th>Rôle</th><th>Périmètre</th><th>Double authentification</th><th>Dernière connexion</th><th></th></tr></thead><tbody>' +
        U.map(function (u) { return '<tr class="' + (+u.actif ? '' : 'off') + '"><td><b>' + esc(u.identifiant) + '</b><small>' + esc(u.nom) + (u.email ? ', ' + esc(u.email) : '') + '</small></td><td>' + (u.role === 'admin' ? 'Administrateur' : 'Commercial') + (+u.actif ? '' : '<small>Désactivé</small>') + '</td>' +
          '<td>' + (u.role === 'admin' ? 'Tout' : esc(com(u.commercial_id))) + '</td><td>' + (+u.a2f ? '<span class="st st-valide">Activée</span>' : '<span class="mu">Non</span>') + '</td><td>' + (u.dernier_acces ? d(u.dernier_acces) : '<span class="mu">Jamais</span>') + '</td><td><button class="bt bl sm" data-u="' + u.id + '">Modifier</button></td></tr>'; }).join('') +
        '</tbody></table></div><form class="card cf" id="uf" hidden><h2 id="uf-t">Nouvel utilisateur</h2><input type="hidden" name="uid">' +
        '<div class="g2"><label class="fl">Identifiant de connexion<input name="identifiant" required autocomplete="off"></label><label class="fl">Nom affiché<input name="nom"></label>' +
        '<label class="fl">E-mail (récupération du mot de passe)<input name="email" type="email"></label><label class="fl">Rôle<select name="role"><option value="commercial">Commercial</option><option value="admin">Administrateur</option></select></label>' +
        '<label class="fl" id="uf-c">Commercial rattaché<select name="commercial_id">' + comOpts(0, 'Choisir') + '</select></label><label class="fl">Mot de passe<input name="mdp" type="password" autocomplete="new-password"><small id="uf-m">10 caractères minimum, lettres et chiffres.</small></label></div>' +
        '<label class="ck"><input type="checkbox" name="actif" checked> Compte actif</label><div class="dr-a"><button class="bt bp">Enregistrer</button><button type="button" class="bt bl" id="uf-x">Annuler</button></div></form>';
      var f = $('#uf');
      function role() { $('#uf-c').hidden = f.role.value === 'admin'; }
      function edit(u) {
        f.hidden = false; $('#uf-t').textContent = u ? 'Modifier ' + u.identifiant : 'Nouvel utilisateur';
        f.uid.value = u ? u.id : ''; f.identifiant.value = u ? u.identifiant : ''; f.nom.value = u ? u.nom : ''; f.email.value = u ? u.email : ''; f.role.value = u ? u.role : 'commercial';
        f.commercial_id.value = u && u.commercial_id ? u.commercial_id : 0; f.actif.checked = u ? !!+u.actif : true; f.mdp.value = '';
        $('#uf-m').textContent = u ? 'Laissez vide pour ne pas changer.' : '10 caractères minimum, lettres et chiffres.'; role();
        f.scrollIntoView({ behavior: 'smooth' }); f.identifiant.focus();
      }
      f.role.addEventListener('change', role);
      $('#u-add').addEventListener('click', function () { edit(null); });
      $('#uf-x').addEventListener('click', function () { f.hidden = true; });
      $$('[data-u]').forEach(function (b) { b.addEventListener('click', function () { edit(U.filter(function (u) { return +u.id === +b.dataset.u; })[0]); }); });
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        api('enr_utilisateur', null, { id: +f.uid.value || 0, identifiant: f.identifiant.value.trim(), nom: f.nom.value.trim(), email: f.email.value.trim(), role: f.role.value, commercial_id: f.role.value === 'admin' ? null : (+f.commercial_id.value || null), actif: f.actif.checked ? 1 : 0, mdp: f.mdp.value })
          .then(function () { toast('Utilisateur enregistré.'); VIEWS.utilisateurs(); }).catch(err);
      });
    }).catch(err);
  };

  // ------------------------------------------------------------------ réglages
  VIEWS.reglages = function () {
    api('reglages').then(function (j) {
      var mo = j.moi; ME = Object.assign(ME || {}, mo);
      $('#main').innerHTML = head('Réglages', '') +
        '<form class="card cf" id="rf"><h2>Mon compte</h2><p class="mu">Connecté en tant que <b>' + esc(mo.identifiant) + '</b> (' + (mo.role === 'admin' ? 'administrateur' : 'commercial') + ').</p>' +
        '<label class="fl">Mon e-mail (pour récupérer le mot de passe)<input name="email" type="email" value="' + esc(mo.email) + '"></label>' +
        (admin() ? '<label class="fl">E-mail qui reçoit les nouvelles inscriptions, demandes et relances<input name="email_notification" type="email" value="' + esc(j.email_notification) + '"></label>' : '') +
        '<h3>Changer le mot de passe</h3><div class="g2"><label class="fl">Mot de passe actuel<input name="mdp_actuel" type="password" autocomplete="current-password"></label>' +
        '<label class="fl">Nouveau mot de passe<input name="nouveau_mdp" type="password" autocomplete="new-password"><small>Laissez vide pour ne pas changer. 10 caractères minimum, lettres et chiffres.</small></label></div>' +
        '<div class="dr-a"><button class="bt bp">Enregistrer</button></div></form>' +
        '<section class="card cf" id="a2f"><h2>Double authentification</h2>' + (+mo.a2f
          ? '<p><span class="st st-valide">Activée</span> Un code de votre téléphone est demandé à chaque connexion.</p><div class="g2"><label class="fl">Mot de passe pour désactiver<input id="a2-p" type="password" autocomplete="current-password"></label></div><div class="dr-a"><button class="bt bl" id="a2-off">Désactiver</button></div>'
          : '<p class="mu">Protégez le backoffice : en plus du mot de passe, un code à 6 chiffres généré par Google Authenticator ou Microsoft Authenticator sera demandé.</p><div class="dr-a"><button class="bt bp" id="a2-on">Activer</button></div><div id="a2-s"></div>') + '</section>' +
        (admin() ? '<form class="card cf" id="of"><h2>Odoo</h2><p class="mu">Devis PDF, confirmation de commande, factures et règlements gérés dans votre Odoo. Utilisez un utilisateur Odoo avec les droits Ventes et une clé API (Préférences, Sécurité du compte, Nouvelle clé API).</p>' +
          '<div class="g2"><label class="fl">Adresse Odoo<input name="odoo_url" placeholder="https://votresociete.odoo.com" value="' + esc(j.odoo_url) + '"></label><label class="fl">Base de données<input name="odoo_db" value="' + esc(j.odoo_db) + '"></label>' +
          '<label class="fl">Utilisateur (e-mail de connexion)<input name="odoo_user" value="' + esc(j.odoo_user) + '" autocomplete="off"></label><label class="fl">Clé API<input name="odoo_key" type="password" autocomplete="new-password" placeholder="' + (j.odoo_key_ok ? 'Enregistrée, laisser vide pour la garder' : '') + '"></label></div>' +
          '<label class="ck"><input type="checkbox" name="odoo_auto"' + (j.odoo_auto ? ' checked' : '') + '> Créer automatiquement le devis dans Odoo à chaque nouvelle demande</label>' +
          '<label class="ck"><input type="checkbox" name="odoo_prix_ht"' + (j.odoo_prix_ht !== false ? ' checked' : '') + '> Envoyer les prix hors taxes à Odoo (Odoo ajoute la TVA 20 % des articles)</label>' +
          '<div class="dr-a"><button class="bt bp">Enregistrer</button><button type="button" class="bt bl" id="o-test">Tester la connexion</button></div><p id="o-res"></p></form>' +
          '<form class="card cf" id="cmf"><h2>Paiement par carte (CMI)</h2><p class="mu">Le client paie sur la page sécurisée du CMI (3D Secure), par un lien envoyé après confirmation de sa commande, pour le montant que vous avez fixé. Aucune donnée de carte ne passe par votre site.</p>' +
          '<div class="g2"><label class="fl">Numéro de magasin (Client ID)<input name="cmi_clientid" value="' + esc(j.cmi_clientid) + '" autocomplete="off"></label><label class="fl">Clé du magasin (Store Key)<input name="cmi_storekey" type="password" autocomplete="new-password" placeholder="' + (j.cmi_key_ok ? 'Enregistrée, laisser vide pour la garder' : '') + '"></label>' +
          '<label class="fl">Environnement<select name="cmi_mode"><option value="test"' + (j.cmi_mode !== 'prod' ? ' selected' : '') + '>Test (recette CMI)</option><option value="prod"' + (j.cmi_mode === 'prod' ? ' selected' : '') + '>Production</option></select></label></div>' +
          '<p class="mu sm">Adresse de notification à communiquer au CMI :</p><div class="cp"><code>' + esc(j.cmi_callback) + '</code><button type="button" class="bt bl sm" data-copy="' + esc(j.cmi_callback) + '">Copier</button></div>' +
          '<label class="ck"><input type="checkbox" name="cmi_actif"' + (j.cmi_actif ? ' checked' : '') + '> Proposer le paiement par carte aux clients</label>' +
          '<div class="dr-a"><button class="bt bp">Enregistrer</button></div></form>' : '') +
        (admin() ? '<section class="card cf"><h2>Sauvegardes et relances automatiques</h2>' +
          '<p>Dernière sauvegarde : <b>' + (j.derniere_sauvegarde ? d(j.derniere_sauvegarde) : 'aucune') + '</b></p><div class="dr-a"><a class="bt bp" href="' + dl('sauvegarde') + '" data-dl>Télécharger une sauvegarde complète</a></div>' +
          '<p class="mu">Pour une sauvegarde quotidienne (14 jours conservés) et l\'e-mail des relances chaque matin, créez une tâche planifiée dans cPanel, rubrique Tâches Cron, une fois par jour à 7 h :</p>' +
          '<div class="cp"><code>' + esc(j.cron_cmd) + '</code><button class="bt bl sm" data-copy="' + esc(j.cron_cmd) + '">Copier</button></div>' +
          '<p class="mu sm">Ou, depuis un service externe, appelez cette adresse secrète :</p><div class="cp"><code>' + esc(j.cron_url) + '</code><button class="bt bl sm" data-copy="' + esc(j.cron_url) + '">Copier</button></div></section>' +
          '<section class="card cf"><h2>Exports</h2><div class="dr-a"><a class="bt bl" href="' + dl('export&t=clients') + '" data-dl>Comptes pro (CSV)</a><a class="bt bl" href="' + dl('export&t=demandes') + '" data-dl>Demandes (CSV)</a><a class="bt bl" href="' + dl('export&t=produits') + '" data-dl>Catalogue (CSV)</a><a class="bt bl" href="' + dl('export&t=whatsapp') + '" data-dl>Catalogue WhatsApp / Meta</a></div>' +
          '<p class="mu sm">Le fichier WhatsApp / Meta s\'importe dans Meta Commerce Manager pour afficher vos produits dans WhatsApp Business et sur Facebook.</p></section>' : '');
      $('#rf').addEventListener('submit', function (e) {
        e.preventDefault(); var f = e.target, b = { email: f.email.value.trim(), mdp_actuel: f.mdp_actuel.value, nouveau_mdp: f.nouveau_mdp.value };
        if (f.email_notification) b.email_notification = f.email_notification.value.trim();
        api('enr_reglages', null, b).then(function () { f.mdp_actuel.value = ''; f.nouveau_mdp.value = ''; toast('Réglages enregistrés.'); }).catch(err);
      });
      if ($('#of')) {
        var of = $('#of');
        var oSave = function () { return api('enr_reglages', null, { odoo_url: of.odoo_url.value.trim(), odoo_db: of.odoo_db.value.trim(), odoo_user: of.odoo_user.value.trim(), odoo_key: of.odoo_key.value.trim(), odoo_auto: of.odoo_auto.checked ? 1 : 0, odoo_prix_ht: of.odoo_prix_ht.checked ? 1 : 0 }); };
        of.addEventListener('submit', function (e) { e.preventDefault(); oSave().then(function () { of.odoo_key.value = ''; toast('Réglages Odoo enregistrés.'); }).catch(err); });
        $('#o-test').addEventListener('click', function () {
          var res = $('#o-res'); res.className = 'mu'; res.textContent = 'Connexion à Odoo...';
          oSave().then(function () { return api('odoo_test', null, {}); }).then(function (t) { res.className = 'ok-t'; res.textContent = 'Connecté à Odoo ' + t.version + ', société ' + t.societe + ', utilisateur ' + t.utilisateur + '.'; })
            .catch(function (e) { res.className = 'ko-t'; res.textContent = (e && e.msg) || 'Connexion impossible.'; });
        });
        var cf2 = $('#cmf');
        cf2.addEventListener('submit', function (e) { e.preventDefault();
          api('enr_reglages', null, { cmi_clientid: cf2.cmi_clientid.value.trim(), cmi_storekey: cf2.cmi_storekey.value.trim(), cmi_mode: cf2.cmi_mode.value, cmi_actif: cf2.cmi_actif.checked ? 1 : 0 })
            .then(function () { cf2.cmi_storekey.value = ''; toast('Réglages du paiement par carte enregistrés.'); }).catch(err);
        });
      }
      if ($('#a2-off')) $('#a2-off').addEventListener('click', function () { api('a2f_desactiver', null, { mdp: $('#a2-p').value }).then(function () { toast('Double authentification désactivée.'); VIEWS.reglages(); }).catch(err); });
      if ($('#a2-on')) $('#a2-on').addEventListener('click', function () {
        api('a2f_init', null, {}).then(function (k) {
          $('#a2-on').hidden = true;
          $('#a2-s').innerHTML = '<ol class="steps"><li>Installez Google Authenticator ou Microsoft Authenticator sur votre téléphone.</li><li>Scannez ce QR code, ou saisissez la clé à la main.</li><li>Saisissez le code à 6 chiffres affiché pour confirmer.</li></ol>' +
            '<div class="qr-w"><div id="qr" class="qr"></div><div><p class="mu sm">Clé à saisir à la main</p><div class="cp"><code>' + esc(k.secret.replace(/(.{4})/g, '$1 ').trim()) + '</code><button class="bt bl sm" data-copy="' + esc(k.secret) + '">Copier</button></div>' +
            '<label class="fl">Code affiché<input id="a2-c" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></label><div class="dr-a"><button class="bt bp" id="a2-ok">Confirmer et activer</button></div></div></div>';
          qr(k.uri);
          $('#a2-ok').addEventListener('click', function () { api('a2f_activer', null, { code: $('#a2-c').value.replace(/\s/g, '') }).then(function () { toast('Double authentification activée.'); VIEWS.reglages(); }).catch(err); });
        }).catch(err);
      });
    }).catch(err);
  };
  function qr(uri) {
    function draw() { try { new window.QRCode($('#qr'), { text: uri, width: 168, height: 168, colorDark: '#0A1F3D', colorLight: '#ffffff' }); } catch (e) { $('#qr').hidden = true; } }
    if (window.QRCode) return draw();
    var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'; s.onload = draw; s.onerror = function () { $('#qr').hidden = true; }; document.head.appendChild(s);
  }
  document.addEventListener('click', function (e) { var a = e.target.closest('a[data-dl]'); if (a && DEMO && a.getAttribute('href') === '#') { e.preventDefault(); toast('Les téléchargements fonctionnent une fois le site en ligne.'); } });

  // application installable sur téléphone
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('../sw.js').catch(function () {});
  var IE = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); IE = e; $('#app-inst').hidden = false; });
  $('#app-inst').addEventListener('click', function () { if (!IE) return; IE.prompt(); IE.userChoice.then(function () { IE = null; $('#app-inst').hidden = true; }); });

  start();
})();
