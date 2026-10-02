<?php
/* API du backoffice DIGITAL BOX TECHNOLOGIES. */
require __DIR__ . '/_lib.php';
require __DIR__ . '/_odoo.php';
require __DIR__ . '/_cmi.php';
admin_session();
$a = s($_GET['a'] ?? '', 30);
$in = ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' ? input() : [];
$installe = (int)db()->query('SELECT COUNT(*) FROM utilisateurs')->fetchColumn() > 0;

function cle_installation(): string {
    $f = data_dir() . '/CLE-INSTALLATION.txt';
    if (!file_exists($f)) { file_put_contents($f, strtoupper(token(5)) . "\n"); }
    return trim((string)file_get_contents($f));
}
function mdp_ok(string $p): bool { return mb_strlen($p) >= 10 && preg_match('/[A-Za-z]/', $p) && preg_match('/\d/', $p); }
function connecter(array $u): void {
    session_regenerate_id(true); $_SESSION['uid'] = (int)$u['id']; unset($_SESSION['a2f_uid']);
    db()->prepare('UPDATE utilisateurs SET dernier_acces=? WHERE id=?')->execute([now(), $u['id']]);
}
function own(array $u, string $table, int $id): array {
    $st = db()->prepare("SELECT * FROM $table WHERE id=?"); $st->execute([$id]); $r = $st->fetch();
    if (!$r) { fail('Introuvable.', 404); }
    if ($u['role'] !== 'admin' && (int)$r['commercial_id'] !== (int)$u['commercial_id']) { fail('Ce dossier est suivi par un autre commercial.', 403); }
    return $r;
}
function csv_out(string $name, array $rows): void {
    header('Content-Type: text/csv; charset=utf-8'); header('Content-Disposition: attachment; filename="' . $name . '-' . gmdate('Y-m-d') . '.csv"');
    $o = fopen('php://output', 'w'); fwrite($o, "\xEF\xBB\xBF");
    if ($rows) { fputcsv($o, array_keys($rows[0]), ';'); foreach ($rows as $r) { fputcsv($o, array_map(fn($v) => preg_match('/^[=+\-@]/', (string)$v) ? "'" . $v : $v, $r), ';'); } }
    exit;
}

switch ($a) {
/* ------------------------------------------------------------------ authentification */
case 'etat':
    if (!$installe) { cle_installation(); }
    $u = me();
    out(['ok' => true, 'installe' => $installe, 'connecte' => (bool)$u, 'a2f_attendu' => !empty($_SESSION['a2f_uid']), 'csrf' => $_SESSION['csrf'], 'moi' => $u]);

case 'installer':
    require_post();
    if ($installe) { fail('Le backoffice est déjà installé.'); }
    throttle('installer', 5, 900);
    if (!hash_equals(cle_installation(), strtoupper(s($in['cle'] ?? '', 40)))) { fail("Clé d'installation incorrecte."); }
    $id = s($in['utilisateur'] ?? '', 60); $p = (string)($in['mdp'] ?? '');
    if ($id === '') { fail("Choisissez un nom d'utilisateur."); }
    if (!mdp_ok($p)) { fail('Mot de passe : 10 caractères minimum, avec lettres et chiffres.'); }
    db()->prepare("INSERT INTO utilisateurs (identifiant, nom, email, role, hash, cree_le) VALUES (?,?,?,'admin',?,?)")
      ->execute([$id, $id, strtolower(s($in['email'] ?? '', 160)), password_hash($p, PASSWORD_DEFAULT), now()]);
    $uid = (int)db()->lastInsertId();
    @unlink(data_dir() . '/CLE-INSTALLATION.txt');
    if (!setting('cron_cle')) { set_setting('cron_cle', token(16)); }
    connecter(['id' => $uid]);
    out(['ok' => true, 'csrf' => $_SESSION['csrf']]);

case 'connexion':
    require_post(); throttle('connexion', 6, 900);
    $st = db()->prepare('SELECT * FROM utilisateurs WHERE identifiant=? AND actif=1'); $st->execute([s($in['utilisateur'] ?? '', 60)]); $u = $st->fetch();
    if (!$u || !password_verify((string)($in['mdp'] ?? ''), $u['hash'])) { usleep(400000); fail('Identifiants incorrects.', 401); }
    if ($u['totp'] !== '') { $_SESSION['a2f_uid'] = (int)$u['id']; out(['ok' => true, 'a2f' => true]); }
    connecter($u); out(['ok' => true, 'csrf' => $_SESSION['csrf']]);

case 'code_a2f':
    require_post(); throttle('a2f', 6, 900);
    $st = db()->prepare('SELECT * FROM utilisateurs WHERE id=? AND actif=1'); $st->execute([(int)($_SESSION['a2f_uid'] ?? 0)]); $u = $st->fetch();
    if (!$u || !totp_ok($u['totp'], s($in['code'] ?? '', 10))) { fail('Code incorrect.', 401); }
    connecter($u); out(['ok' => true, 'csrf' => $_SESSION['csrf']]);

case 'oubli':
    require_post(); throttle('oubli', 4, 900);
    $q = strtolower(s($in['utilisateur'] ?? '', 160));
    $st = db()->prepare("SELECT id, email FROM utilisateurs WHERE actif=1 AND email != '' AND (lower(identifiant)=? OR lower(email)=?)"); $st->execute([$q, $q]);
    if ($u = $st->fetch()) {
        $t = token(16);
        db()->prepare('UPDATE utilisateurs SET reset_hash=?, reset_exp=? WHERE id=?')->execute([hash('sha256', $t), time() + 3600, $u['id']]);
        send_mail($u['email'], 'Réinitialisation de votre mot de passe backoffice', "Pour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n" . site_url() . "/admin/index.html?reset={$u['id']}.$t\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.");
    }
    out(['ok' => true]);

case 'reinitialiser':
    require_post(); throttle('reinit', 6, 900);
    [$id, $t] = array_pad(explode('.', s($in['jeton'] ?? '', 120), 2), 2, '');
    $st = db()->prepare('SELECT * FROM utilisateurs WHERE id=? AND actif=1'); $st->execute([(int)$id]); $u = $st->fetch();
    if (!$u || !$u['reset_hash'] || $u['reset_exp'] < time() || !hash_equals($u['reset_hash'], hash('sha256', $t))) { fail('Lien expiré ou invalide.'); }
    if (!mdp_ok((string)($in['mdp'] ?? ''))) { fail('Mot de passe : 10 caractères minimum, avec lettres et chiffres.'); }
    db()->prepare("UPDATE utilisateurs SET hash=?, reset_hash='', reset_exp=0 WHERE id=?")->execute([password_hash((string)$in['mdp'], PASSWORD_DEFAULT), $u['id']]);
    out(['ok' => true]);

case 'deconnexion':
    $_SESSION = []; session_destroy(); out(['ok' => true]);

/* ------------------------------------------------------------------ tableau de bord */
case 'tableau':
    $u = require_admin(false); [$w, $p] = scope($u);
    $n = function (string $sql, array $args = []) { $st = db()->prepare($sql); $st->execute($args); return $st->fetchColumn(); };
    $mois = gmdate('Y-m-01');
    $dl = db()->prepare("SELECT id, cree_le, statut, societe, nom, ville FROM clients WHERE $w ORDER BY id DESC LIMIT 5"); $dl->execute($p);
    $dd = db()->prepare("SELECT id, ref, cree_le, statut, type, societe, nom, total FROM demandes WHERE $w ORDER BY id DESC LIMIT 5"); $dd->execute($p);
    $par = db()->prepare("SELECT statut, COUNT(*) AS n FROM demandes WHERE $w GROUP BY statut"); $par->execute($p);
    out(['ok' => true,
        'clients_nouveaux' => (int)$n("SELECT COUNT(*) FROM clients WHERE statut='nouveau' AND $w", $p),
        'clients_valides' => (int)$n("SELECT COUNT(*) FROM clients WHERE statut='valide' AND $w", $p),
        'demandes_nouvelles' => (int)$n("SELECT COUNT(*) FROM demandes WHERE statut='nouveau' AND $w", $p),
        'demandes_30j' => (int)$n("SELECT COUNT(*) FROM demandes WHERE cree_le >= ? AND $w", array_merge([gmdate('Y-m-d', time() - 30 * 86400)], $p)),
        'en_cours' => (int)$n("SELECT COUNT(*) FROM demandes WHERE statut IN ('confirme','commande_fournisseur','expedie') AND $w", $p),
        'ca_mois' => (float)$n("SELECT COALESCE(SUM(total),0) FROM demandes WHERE statut='livre' AND maj_le >= ? AND $w", array_merge([$mois], $p)),
        'a_encaisser' => (float)$n("SELECT COALESCE(SUM(total),0) FROM demandes WHERE paiement='facture' AND $w", $p),
        'avis_attente' => $u['role'] === 'admin' ? (int)$n("SELECT COUNT(*) FROM avis WHERE statut='nouveau'") : 0,
        'par_statut' => $par->fetchAll(), 'relances' => a_relancer($u),
        'derniers_clients' => $dl->fetchAll(), 'dernieres_demandes' => $dd->fetchAll(), 'derniere_sauvegarde' => setting('derniere_sauvegarde', '')]);

/* ------------------------------------------------------------------ comptes pro et demandes */
case 'clients':
case 'demandes':
    $u = require_admin(false); [$w0, $p] = scope($u); $w = [$w0];
    if (($st = s($_GET['statut'] ?? '', 30)) !== '') {
        if ($st === 'actives') { $w[] = "statut IN ('nouveau','devis_envoye','confirme','commande_fournisseur','expedie')"; }
        else { $w[] = 'statut=?'; $p[] = $st; }
    }
    if (($q = s($_GET['q'] ?? '', 80)) !== '') {
        $w[] = '(societe LIKE ? OR nom LIKE ? OR email LIKE ? OR telephone LIKE ? OR ice LIKE ? OR ville LIKE ?' . ($a === 'demandes' ? ' OR ref LIKE ?' : '') . ')';
        array_push($p, ...array_fill(0, $a === 'demandes' ? 7 : 6, "%$q%"));
    }
    if (($c = (int)($_GET['commercial'] ?? 0)) > 0) { $w[] = 'commercial_id=?'; $p[] = $c; }
    $cols = $a === 'clients' ? 'id, cree_le, statut, type, societe, ice, nom, fonction, email, telephone, ville, univers, message, commercial_id, notes, remise, hash != \'\' AS actif_espace, dernier_acces'
                             : 'id, ref, cree_le, statut, type, nom, societe, ice, email, telephone, ville, contenu, total, univers, commercial_id, notes, paiement, fichier, lignes, client_id, maj_le, suivi, odoo_id, odoo_ref, odoo_etat';
    $q = db()->prepare("SELECT $cols FROM $a WHERE " . implode(' AND ', $w) . ' ORDER BY id DESC LIMIT 500'); $q->execute($p);
    $rows = $q->fetchAll();
    if ($a === 'demandes') {
        $pay = db()->prepare('SELECT oid, montant, statut, cree_le, code, message, autorisation, carte FROM paiements WHERE demande_id=? ORDER BY id DESC');
        foreach ($rows as &$r) {
            $r['lignes'] = json_decode($r['lignes'], true) ?: [];
            $r['payable'] = cmi_payable($r); $r['lien_paiement'] = $r['payable'] ? cmi_lien($r) : '';
            $r['lien_suivi'] = site_url() . '/suivi-commande.html?ref=' . $r['ref'] . '&k=' . $r['suivi']; unset($r['suivi']);
            $pay->execute([$r['id']]); $r['paiements'] = $pay->fetchAll();
            if ($r['odoo_id']) { $r += odoo_liens((int)$r['id']); }
        }
        unset($r);
    }
    out(['ok' => true, 'lignes' => $rows, 'etapes' => ETAPES, 'odoo' => odoo_pret(), 'cmi' => cmi_pret()]);

case 'historique':
    $u = require_admin(false); own($u, 'demandes', (int)($_GET['id'] ?? 0));
    $h = db()->prepare('SELECT quand, etape, note, par, visible FROM historique WHERE demande_id=? ORDER BY id'); $h->execute([(int)$_GET['id']]);
    $d = db()->prepare('SELECT ref, suivi FROM demandes WHERE id=?'); $d->execute([(int)$_GET['id']]); $d = $d->fetch();
    out(['ok' => true, 'historique' => $h->fetchAll(), 'lien_suivi' => site_url() . '/suivi-commande.html?ref=' . $d['ref'] . '&k=' . $d['suivi']]);

case 'maj_client':
    require_post(); $u = require_admin();
    $r = own($u, 'clients', (int)($in['id'] ?? 0));
    $set = []; $p = [];
    if (isset($in['statut'])) { if (!in_array($in['statut'], ['nouveau', 'valide', 'refuse', 'archive'], true)) { fail('Statut invalide.'); } $set[] = 'statut=?'; $p[] = $in['statut']; }
    if (array_key_exists('commercial_id', $in) && $u['role'] === 'admin') { $set[] = 'commercial_id=?'; $p[] = ((int)$in['commercial_id']) ?: null; }
    if (isset($in['notes'])) { $set[] = 'notes=?'; $p[] = s($in['notes'], 4000); }
    if (isset($in['remise'])) { $set[] = 'remise=?'; $p[] = max(0, min(60, round((float)$in['remise'], 2))); }
    if (!$set) { fail('Rien à modifier.'); }
    $set[] = 'maj_le=?'; $p[] = now(); $p[] = $r['id'];
    db()->prepare('UPDATE clients SET ' . implode(',', $set) . ' WHERE id=?')->execute($p);
    out(['ok' => true]);

case 'invitation':            // lien d'activation de l'espace client, à envoyer par WhatsApp ou e-mail
    require_post(); $u = require_admin();
    $r = own($u, 'clients', (int)($in['id'] ?? 0));
    if ($r['statut'] !== 'valide') { fail("Validez d'abord le compte pro."); }
    $t = token(16);
    db()->prepare('UPDATE clients SET invite_hash=?, invite_exp=? WHERE id=?')->execute([hash('sha256', $t), time() + 7 * 86400, $r['id']]);
    $lien = site_url() . "/espace-client.html?c={$r['id']}&t=$t";
    $mail = !empty($in['email']) && send_mail($r['email'], 'Votre espace client DIGITAL BOX TECHNOLOGIES', "Bonjour {$r['nom']},\n\nVotre compte pro est validé. Créez votre mot de passe pour accéder à vos prix professionnels et suivre vos commandes (lien valable 7 jours) :\n$lien");
    out(['ok' => true, 'lien' => $lien, 'email_envoye' => $mail]);

case 'maj_demande':
    require_post(); $u = require_admin();
    $r = own($u, 'demandes', (int)($in['id'] ?? 0));
    $set = []; $p = [];
    if (isset($in['statut']) && $in['statut'] !== $r['statut']) {
        if (!array_key_exists($in['statut'], ETAPES)) { fail('Étape invalide.'); }
        $set[] = 'statut=?'; $p[] = $in['statut'];
        $note = s($in['note_client'] ?? '', 500);
        add_etape((int)$r['id'], $in['statut'], $note, $u['identifiant']);
        if (!empty($in['prevenir']) && $r['email']) {
            send_mail($r['email'], "Votre demande {$r['ref']} : " . ETAPES[$in['statut']], "Bonjour,\n\nVotre demande {$r['ref']} est passée à l'étape : " . ETAPES[$in['statut']] . '.' . ($note ? "\n\n$note" : '') .
                "\n\nSuivi en ligne : " . site_url() . "/suivi-commande.html?ref={$r['ref']}&k={$r['suivi']}");
        }
    }
    if (isset($in['paiement'])) { if (!in_array($in['paiement'], ['en_attente', 'facture', 'paye'], true)) { fail('Paiement invalide.'); } $set[] = 'paiement=?'; $p[] = $in['paiement']; }
    if (array_key_exists('commercial_id', $in) && $u['role'] === 'admin') { $set[] = 'commercial_id=?'; $p[] = ((int)$in['commercial_id']) ?: null; }
    if (isset($in['notes'])) { $set[] = 'notes=?'; $p[] = s($in['notes'], 4000); }
    if (isset($in['total'])) { $set[] = 'total=?'; $p[] = max(0, (float)$in['total']); }
    if (!$set) { out(['ok' => true]); }
    $set[] = 'maj_le=?'; $p[] = now(); $p[] = $r['id'];
    db()->prepare('UPDATE demandes SET ' . implode(',', $set) . ' WHERE id=?')->execute($p);
    out(['ok' => true]);

case 'fichier':
    $u = require_admin(false); $r = own($u, 'demandes', (int)($_GET['id'] ?? 0));
    $f = data_dir('fichiers') . '/' . basename((string)$r['fichier']);
    if (!$r['fichier'] || !is_file($f)) { fail('Aucun fichier.', 404); }
    $mime = ['pdf' => 'application/pdf', 'jpg' => 'image/jpeg', 'png' => 'image/png'][pathinfo($f, PATHINFO_EXTENSION)] ?? 'application/octet-stream';
    header('Content-Type: ' . $mime); header('Content-Disposition: inline; filename="bon-de-commande-' . $r['ref'] . '.' . pathinfo($f, PATHINFO_EXTENSION) . '"');
    header('X-Content-Type-Options: nosniff'); readfile($f); exit;

/* ------------------------------------------------------------------ catalogue */
case 'produits':
    require_admin(false);
    out(['ok' => true, 'lignes' => db()->query('SELECT * FROM produits ORDER BY univers, categorie, nom')->fetchAll()]);

case 'maj_produit':
    require_post(); require_admin(true, true);
    $dispo = in_array($in['dispo'] ?? '', ['En stock', 'Sur commande', 'Rupture'], true) ? $in['dispo'] : 'Sur commande';
    db()->prepare('UPDATE produits SET prix_ttc=?, prix_barre=?, dispo=?, en_avant=?, masque=?, maj_le=? WHERE id=?')
      ->execute([max(0, (float)($in['prix_ttc'] ?? 0)), max(0, (float)($in['prix_barre'] ?? 0)), $dispo, empty($in['en_avant']) ? 0 : 1, empty($in['masque']) ? 0 : 1, now(), s($in['id'] ?? '', 160)]);
    out(['ok' => true]);

case 'import_prix':           // liste de prix distributeur : référence ; prix TTC ; disponibilité (facultative)
    require_post(); require_admin(true, true);
    $txt = (string)($in['csv'] ?? ''); $coef = (float)($in['coef'] ?? 1) ?: 1;
    $ok = 0; $inconnus = [];
    $up = db()->prepare('UPDATE produits SET prix_ttc=?, dispo=COALESCE(?, dispo), maj_le=? WHERE upper(sku)=upper(?) AND sku != \'\'');
    foreach (preg_split('/\r\n|\n|\r/', $txt) as $line) {
        $c = str_getcsv($line, str_contains($line, ';') ? ';' : ',');
        if (count($c) < 2) { continue; }
        $sku = s($c[0], 60); $prix = (float)str_replace([' ', ','], ['', '.'], (string)$c[1]);
        if ($sku === '' || $prix <= 0) { continue; }
        $d = isset($c[2]) && in_array(trim($c[2]), ['En stock', 'Sur commande', 'Rupture'], true) ? trim($c[2]) : null;
        $up->execute([round($prix * $coef, 2), $d, now(), $sku]);
        if ($up->rowCount()) { $ok++; } else { $inconnus[] = $sku; }
    }
    out(['ok' => true, 'mis_a_jour' => $ok, 'inconnus' => array_slice($inconnus, 0, 50)]);

/* ------------------------------------------------------------------ statistiques */
case 'stats':
    require_admin(false);
    $j = max(1, min(365, (int)($_GET['jours'] ?? 30))); $depuis = gmdate('Y-m-d', time() - ($j - 1) * 86400);
    $top = function (string $type, int $lim = 15) use ($depuis) {
        $st = db()->prepare('SELECT cle, SUM(n) AS n FROM stats WHERE type=? AND jour >= ? GROUP BY cle ORDER BY n DESC LIMIT ' . $lim); $st->execute([$type, $depuis]); return $st->fetchAll();
    };
    $tot = db()->prepare('SELECT type, SUM(n) AS n FROM stats WHERE jour >= ? GROUP BY type'); $tot->execute([$depuis]);
    $jours = db()->prepare("SELECT jour, SUM(n) AS n FROM stats WHERE type='page' AND jour >= ? GROUP BY jour ORDER BY jour"); $jours->execute([$depuis]);
    $dem = db()->prepare('SELECT substr(cree_le,1,10) AS jour, COUNT(*) AS n FROM demandes WHERE cree_le >= ? GROUP BY jour ORDER BY jour'); $dem->execute([$depuis]);
    $villes = db()->prepare("SELECT ville AS cle, COUNT(*) AS n FROM demandes WHERE cree_le >= ? AND ville != '' GROUP BY lower(ville) ORDER BY n DESC LIMIT 10"); $villes->execute([$depuis]);
    out(['ok' => true, 'jours' => $j, 'totaux' => array_column($tot->fetchAll(), 'n', 'type'), 'pages_par_jour' => $jours->fetchAll(), 'demandes_par_jour' => $dem->fetchAll(),
         'pages' => $top('page'), 'produits' => $top('produit'), 'recherches' => $top('recherche'), 'recherches_vides' => $top('recherche_vide', 25),
         'demandes_produits' => $top('demande_produit'), 'villes' => $villes->fetchAll()]);

/* ------------------------------------------------------------------ avis */
case 'avis':
    require_admin(false, false);
    out(['ok' => true, 'lignes' => db()->query('SELECT id, cree_le, statut, nom, societe, ville, email, note, texte, produit, client_id FROM avis ORDER BY id DESC LIMIT 300')->fetchAll()]);
case 'maj_avis':
    require_post(); require_admin(true, true);
    if (!in_array($in['statut'] ?? '', ['nouveau', 'publie', 'refuse'], true)) { fail('Statut invalide.'); }
    db()->prepare('UPDATE avis SET statut=? WHERE id=?')->execute([$in['statut'], (int)($in['id'] ?? 0)]);
    out(['ok' => true]);

/* ------------------------------------------------------------------ commerciaux et utilisateurs */
case 'commerciaux':
    require_admin(false);
    out(['ok' => true, 'lignes' => db()->query('SELECT c.*, (SELECT COUNT(*) FROM clients WHERE commercial_id=c.id) AS nb_clients FROM commerciaux c ORDER BY id')->fetchAll()]);

case 'enr_commercial':
    require_post(); require_admin(true, true);
    $id = (int)($in['id'] ?? 0);
    $nom = s($in['nom'] ?? '', 100); $wa = preg_replace('/\D/', '', s($in['whatsapp'] ?? '', 30));
    $un = in_array($in['univers'] ?? '', ['postes', 'infra', 'tous'], true) ? $in['univers'] : 'tous';
    $em = strtolower(s($in['email'] ?? '', 160)); $actif = empty($in['actif']) ? 0 : 1;
    if ($nom === '') { fail('Indiquez le nom du commercial.'); }
    if ($wa !== '' && !preg_match('/^212[5-7]\d{8}$/', $wa)) { fail('Numéro WhatsApp au format 2126XXXXXXXX (indicatif 212 sans le 0).'); }
    if ($em !== '' && !filter_var($em, FILTER_VALIDATE_EMAIL)) { fail('E-mail invalide.'); }
    if ($id > 0) { db()->prepare('UPDATE commerciaux SET nom=?, univers=?, whatsapp=?, email=?, actif=? WHERE id=?')->execute([$nom, $un, $wa, $em, $actif, $id]); }
    else { db()->prepare('INSERT INTO commerciaux (nom, univers, whatsapp, email, actif) VALUES (?,?,?,?,?)')->execute([$nom, $un, $wa, $em, $actif]); }
    out(['ok' => true]);

case 'utilisateurs':
    require_admin(false, true);
    out(['ok' => true, 'lignes' => db()->query("SELECT id, identifiant, nom, email, role, commercial_id, actif, totp != '' AS a2f, dernier_acces FROM utilisateurs ORDER BY id")->fetchAll()]);

case 'enr_utilisateur':
    require_post(); $me = require_admin(true, true);
    $id = (int)($in['id'] ?? 0); $ident = s($in['identifiant'] ?? '', 60);
    $role = ($in['role'] ?? '') === 'admin' ? 'admin' : 'commercial';
    $com = ((int)($in['commercial_id'] ?? 0)) ?: null; $actif = empty($in['actif']) ? 0 : 1; $em = strtolower(s($in['email'] ?? '', 160));
    if ($ident === '') { fail("Indiquez l'identifiant."); }
    if ($role === 'commercial' && !$com) { fail('Rattachez ce compte à un commercial.'); }
    if ($em !== '' && !filter_var($em, FILTER_VALIDATE_EMAIL)) { fail('E-mail invalide.'); }
    if ($id === (int)$me['id'] && (!$actif || $role !== 'admin')) { fail('Vous ne pouvez pas retirer vos propres droits.'); }
    $mdp = (string)($in['mdp'] ?? '');
    if ($mdp !== '' && !mdp_ok($mdp)) { fail('Mot de passe : 10 caractères minimum, avec lettres et chiffres.'); }
    if (!$id && $mdp === '') { fail('Choisissez un mot de passe pour ce nouveau compte.'); }
    try {
        if ($id) {
            db()->prepare('UPDATE utilisateurs SET identifiant=?, nom=?, email=?, role=?, commercial_id=?, actif=? WHERE id=?')->execute([$ident, s($in['nom'] ?? '', 100), $em, $role, $com, $actif, $id]);
            if ($mdp !== '') { db()->prepare('UPDATE utilisateurs SET hash=? WHERE id=?')->execute([password_hash($mdp, PASSWORD_DEFAULT), $id]); }
        } else {
            db()->prepare('INSERT INTO utilisateurs (identifiant, nom, email, role, commercial_id, actif, hash, cree_le) VALUES (?,?,?,?,?,?,?,?)')
              ->execute([$ident, s($in['nom'] ?? '', 100), $em, $role, $com, $actif, password_hash($mdp, PASSWORD_DEFAULT), now()]);
        }
    } catch (PDOException $e) { fail('Cet identifiant existe déjà.'); }
    out(['ok' => true]);

/* ------------------------------------------------------------------ réglages, double authentification, sauvegarde */
case 'reglages':
    $u = require_admin(false);
    $r = ['ok' => true, 'moi' => $u];
    if ($u['role'] === 'admin') {
        if (!setting('cron_cle')) { set_setting('cron_cle', token(16)); }
        $r += ['email_notification' => setting('email_notification', NOTIFY_DEFAULT), 'cron_url' => site_url() . '/api/cron.php?cle=' . setting('cron_cle'),
               'cron_cmd' => 'php ' . realpath(__DIR__ . '/cron.php'), 'derniere_sauvegarde' => setting('derniere_sauvegarde', ''),
               'odoo_url' => setting('odoo_url', ''), 'odoo_db' => setting('odoo_db', ''), 'odoo_user' => setting('odoo_user', ''), 'odoo_key_ok' => setting('odoo_key', '') !== '',
               'odoo_auto' => setting('odoo_auto', '0') === '1', 'odoo_prix_ht' => setting('odoo_prix_ht', '1') === '1',
               'cmi_actif' => setting('cmi_actif', '0') === '1', 'cmi_mode' => setting('cmi_mode', 'test'), 'cmi_clientid' => setting('cmi_clientid', ''), 'cmi_key_ok' => setting('cmi_storekey', '') !== '',
               'cmi_callback' => site_url() . '/api/cmi-callback.php'];
    }
    out($r);

case 'enr_reglages':
    require_post(); $u = require_admin();
    if ($u['role'] === 'admin' && isset($in['email_notification'])) {
        $em = strtolower(s($in['email_notification'], 160));
        if ($em !== '' && !filter_var($em, FILTER_VALIDATE_EMAIL)) { fail('E-mail invalide.'); }
        set_setting('email_notification', $em);
    }
    if ($u['role'] === 'admin' && isset($in['odoo_url'])) {
        $url = rtrim(s($in['odoo_url'], 200), '/');
        if ($url !== '' && !preg_match('#^(https://[^\s/]+|http://(localhost|127\.0\.0\.1)(:\d+)?)#', $url)) { fail("Adresse Odoo : elle doit commencer par https://"); }
        foreach (['odoo_url' => $url, 'odoo_db' => s($in['odoo_db'] ?? '', 100), 'odoo_user' => s($in['odoo_user'] ?? '', 160)] as $k => $v) { set_setting($k, $v); }
        if (($kk = s($in['odoo_key'] ?? '', 200)) !== '') { set_setting('odoo_key', $kk); }
        set_setting('odoo_auto', empty($in['odoo_auto']) ? '0' : '1'); set_setting('odoo_prix_ht', empty($in['odoo_prix_ht']) ? '0' : '1');
    }
    if ($u['role'] === 'admin' && isset($in['cmi_clientid'])) {
        set_setting('cmi_clientid', s($in['cmi_clientid'], 60)); set_setting('cmi_mode', ($in['cmi_mode'] ?? '') === 'prod' ? 'prod' : 'test');
        if (($kk = s($in['cmi_storekey'] ?? '', 200)) !== '') { set_setting('cmi_storekey', $kk); }
        $on = !empty($in['cmi_actif']);
        if ($on && (setting('cmi_clientid', '') === '' || setting('cmi_storekey', '') === '')) { fail('Paiement par carte : renseignez le numéro de magasin et la clé du magasin CMI.'); }
        set_setting('cmi_actif', $on ? '1' : '0');
    }
    if (($nv = (string)($in['nouveau_mdp'] ?? '')) !== '') {
        $st = db()->prepare('SELECT hash FROM utilisateurs WHERE id=?'); $st->execute([$u['id']]);
        if (!password_verify((string)($in['mdp_actuel'] ?? ''), (string)$st->fetchColumn())) { fail('Mot de passe actuel incorrect.'); }
        if (!mdp_ok($nv)) { fail('Nouveau mot de passe : 10 caractères minimum, avec lettres et chiffres.'); }
        db()->prepare('UPDATE utilisateurs SET hash=? WHERE id=?')->execute([password_hash($nv, PASSWORD_DEFAULT), $u['id']]);
    }
    if (isset($in['email'])) {
        $em = strtolower(s($in['email'], 160)); if ($em !== '' && !filter_var($em, FILTER_VALIDATE_EMAIL)) { fail('E-mail invalide.'); }
        db()->prepare('UPDATE utilisateurs SET email=? WHERE id=?')->execute([$em, $u['id']]);
    }
    out(['ok' => true]);

/* ------------------------------------------------------------------ Odoo et paiement par carte */
case 'odoo_test':
    require_post(); require_admin(true, true);
    try { out(['ok' => true] + odoo_test()); } catch (Throwable $e) { fail($e->getMessage()); }

case 'odoo_devis':
case 'odoo_maj':
case 'odoo_confirmer':
    require_post(); $u = require_admin(); $r = own($u, 'demandes', (int)($in['id'] ?? 0));
    try {
        if ($a === 'odoo_devis') { $l = odoo_devis((int)$r['id']); add_etape((int)$r['id'], $r['statut'], 'Devis ' . $l['odoo_ref'] . ' créé dans Odoo', $u['identifiant'], 0); }
        elseif ($a === 'odoo_confirmer') { odoo('sale.order', 'action_confirm', [[(int)$r['odoo_id']]]); $l = odoo_maj((int)$r['id']); }
        else { $l = odoo_maj((int)$r['id']); }
        out(['ok' => true] + $l);
    } catch (Throwable $e) { fail($e->getMessage()); }

case 'envoyer_client':        // devis Odoo et/ou lien de paiement envoyés au client par e-mail
    require_post(); $u = require_admin(); $r = own($u, 'demandes', (int)($in['id'] ?? 0));
    if (!$r['email']) { fail("Ce client n'a pas d'adresse e-mail : envoyez le lien par WhatsApp."); }
    $l = $r['odoo_id'] ? odoo_liens((int)$r['id']) : [];
    $txt = "Bonjour {$r['nom']},\n\n";
    if (!empty($in['devis']) && !empty($l['lien_client'])) { $txt .= "Votre devis {$l['odoo_ref']} pour la demande {$r['ref']} est prêt. Consultez-le, téléchargez-le en PDF ou acceptez-le en ligne :\n{$l['lien_client']}\n\n"; }
    if (!empty($in['paiement'])) { if (!cmi_payable($r)) { fail('Paiement par carte indisponible : activez le CMI et indiquez le montant de la commande.'); } $txt .= 'Vous pouvez régler ' . number_format((float)$r['total'], 2, ',', ' ') . " DH par carte bancaire, en toute sécurité (CMI, 3D Secure) :\n" . cmi_lien($r) . "\n\n"; }
    $txt .= "Suivi de votre demande : " . site_url() . "/suivi-commande.html?ref={$r['ref']}&k={$r['suivi']}";
    if (!send_mail($r['email'], "Votre demande {$r['ref']} - DIGITAL BOX TECHNOLOGIES", $txt)) { fail("L'e-mail n'a pas pu partir : envoyez le lien par WhatsApp."); }
    if (!empty($in['devis']) && $r['statut'] === 'nouveau') { db()->prepare("UPDATE demandes SET statut='devis_envoye', maj_le=? WHERE id=?")->execute([now(), $r['id']]); add_etape((int)$r['id'], 'devis_envoye', 'Devis envoyé par e-mail', $u['identifiant']); }
    out(['ok' => true]);

case 'a2f_init':
    require_post(); $u = require_admin();
    $_SESSION['a2f_secret'] = b32_secret();
    out(['ok' => true, 'secret' => $_SESSION['a2f_secret'], 'uri' => 'otpauth://totp/' . rawurlencode('DBT Backoffice:' . $u['identifiant']) . '?secret=' . $_SESSION['a2f_secret'] . '&issuer=' . rawurlencode('DIGITAL BOX TECHNOLOGIES')]);
case 'a2f_activer':
    require_post(); $u = require_admin();
    $sec = (string)($_SESSION['a2f_secret'] ?? '');
    if ($sec === '' || !totp_ok($sec, s($in['code'] ?? '', 10))) { fail('Code incorrect. Vérifiez l\'heure de votre téléphone et réessayez.'); }
    db()->prepare('UPDATE utilisateurs SET totp=? WHERE id=?')->execute([$sec, $u['id']]); unset($_SESSION['a2f_secret']);
    out(['ok' => true]);
case 'a2f_desactiver':
    require_post(); $u = require_admin();
    $st = db()->prepare('SELECT hash FROM utilisateurs WHERE id=?'); $st->execute([$u['id']]);
    if (!password_verify((string)($in['mdp'] ?? ''), (string)$st->fetchColumn())) { fail('Mot de passe incorrect.'); }
    db()->prepare("UPDATE utilisateurs SET totp='' WHERE id=?")->execute([$u['id']]);
    out(['ok' => true]);

case 'sauvegarde':            // téléchargement d'une copie complète de la base
    require_admin(false, true);
    $f = data_dir('sauvegardes') . '/manuelle-' . gmdate('Ymd-His') . '.sqlite';
    db()->exec('VACUUM INTO ' . db()->quote($f));
    set_setting('derniere_sauvegarde', now());
    header('Content-Type: application/octet-stream'); header('Content-Disposition: attachment; filename="dbt-backoffice-' . gmdate('Y-m-d') . '.sqlite"');
    readfile($f); @unlink($f); exit;

/* ------------------------------------------------------------------ exports */
case 'export':
    $u = require_admin(false); [$w, $p] = scope($u, 'x');
    $t = $_GET['t'] ?? 'clients';
    if ($t === 'produits') { csv_out('produits', db()->query('SELECT id, sku, nom, marque, categorie, univers, prix_ttc, prix_barre, dispo, en_avant, masque FROM produits ORDER BY univers, categorie, nom')->fetchAll()); }
    if ($t === 'whatsapp') {      // catalogue Meta / WhatsApp Business (Commerce Manager)
        $rows = [];
        foreach (db()->query("SELECT * FROM produits WHERE masque=0 AND prix_ttc > 0")->fetchAll() as $r) {
            $rows[] = ['id' => $r['id'], 'title' => $r['nom'], 'description' => $r['nom'] . ' - ' . $r['marque'], 'availability' => $r['dispo'] === 'Rupture' ? 'out of stock' : 'in stock',
                       'condition' => 'new', 'price' => number_format((float)$r['prix_ttc'], 2, '.', '') . ' MAD', 'link' => site_url() . '/' . $r['id'] . '.html',
                       'image_link' => site_url() . '/' . $r['image'], 'brand' => $r['marque']];
        }
        csv_out('catalogue-whatsapp', $rows);
    }
    $t = $t === 'demandes' ? 'demandes' : 'clients';
    $st = db()->prepare("SELECT x.*, c.nom AS commercial FROM $t x LEFT JOIN commerciaux c ON c.id=x.commercial_id WHERE $w ORDER BY x.id DESC"); $st->execute($p);
    $rows = $st->fetchAll();
    foreach ($rows as &$r) { unset($r['ip'], $r['hash'], $r['invite_hash'], $r['invite_exp'], $r['suivi']); } unset($r);
    csv_out($t, $rows);

default:
    fail('Action inconnue.', 404);
}
