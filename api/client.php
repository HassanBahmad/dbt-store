<?php
/* Espace client pro : activation du compte, connexion, prix remisés, historique et recommande. */
require __DIR__ . '/_lib.php';
start_session('dbtclient');
$a = s($_GET['a'] ?? '', 30);
$in = ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' ? input() : [];
function flag(bool $on): void { setcookie('dbtpro', $on ? '1' : '', ['expires' => $on ? 0 : 1, 'path' => '/', 'secure' => !empty($_SERVER['HTTPS']), 'samesite' => 'Lax']); }
function mdp_ok(string $p): bool { return mb_strlen($p) >= 8 && preg_match('/[A-Za-z]/', $p) && preg_match('/\d/', $p); }
function client(): array {
    if (empty($_SESSION['cid'])) { fail('Session expirée, reconnectez-vous.', 401); }
    $st = db()->prepare("SELECT c.*, m.nom AS commercial, m.whatsapp AS commercial_wa FROM clients c LEFT JOIN commerciaux m ON m.id=c.commercial_id WHERE c.id=? AND c.statut='valide'");
    $st->execute([$_SESSION['cid']]); $c = $st->fetch();
    if (!$c) { $_SESSION = []; fail('Compte inactif.', 401); }
    return $c;
}

switch ($a) {
case 'etat':
    out(['ok' => true, 'connecte' => !empty($_SESSION['cid']), 'csrf' => $_SESSION['csrf']]);

case 'activer':          // lien d'invitation ou de réinitialisation : ?c=ID&t=JETON
    require_post(); throttle('client_activer', 8, 900);
    $id = (int)($in['c'] ?? 0); $t = s($in['t'] ?? '', 80); $p = (string)($in['mdp'] ?? '');
    $st = db()->prepare("SELECT id, invite_hash, invite_exp FROM clients WHERE id=? AND statut='valide'"); $st->execute([$id]); $c = $st->fetch();
    if (!$c || !$c['invite_hash'] || $c['invite_exp'] < time() || !hash_equals($c['invite_hash'], hash('sha256', $t))) { fail('Lien expiré ou invalide. Demandez un nouveau lien à votre commercial.'); }
    if (!mdp_ok($p)) { fail('Mot de passe : 8 caractères minimum, avec lettres et chiffres.'); }
    db()->prepare("UPDATE clients SET hash=?, invite_hash='', invite_exp=0 WHERE id=?")->execute([password_hash($p, PASSWORD_DEFAULT), $id]);
    session_regenerate_id(true); $_SESSION['cid'] = $id; flag(true);
    out(['ok' => true, 'csrf' => $_SESSION['csrf']]);

case 'connexion':
    require_post(); throttle('client_connexion', 8, 900);
    $st = db()->prepare("SELECT id, hash FROM clients WHERE email=? AND statut='valide' AND hash != '' ORDER BY id DESC LIMIT 1");
    $st->execute([strtolower(s($in['email'] ?? '', 160))]); $c = $st->fetch();
    if (!$c || !password_verify((string)($in['mdp'] ?? ''), $c['hash'])) { usleep(400000); fail('E-mail ou mot de passe incorrect.', 401); }
    session_regenerate_id(true); $_SESSION['cid'] = (int)$c['id']; flag(true);
    db()->prepare('UPDATE clients SET dernier_acces=? WHERE id=?')->execute([now(), $c['id']]);
    out(['ok' => true, 'csrf' => $_SESSION['csrf']]);

case 'oubli':
    require_post(); throttle('client_oubli', 4, 900);
    $st = db()->prepare("SELECT id, email FROM clients WHERE email=? AND statut='valide' ORDER BY id DESC LIMIT 1");
    $st->execute([strtolower(s($in['email'] ?? '', 160))]);
    if ($c = $st->fetch()) {
        $t = token(16);
        db()->prepare('UPDATE clients SET invite_hash=?, invite_exp=? WHERE id=?')->execute([hash('sha256', $t), time() + 86400, $c['id']]);
        send_mail($c['email'], 'Votre accès à l\'espace client', "Bonjour,\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 24 heures) :\n" . site_url() . "/espace-client.html?c={$c['id']}&t=$t\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.");
    }
    out(['ok' => true]);   // même réponse que l'adresse existe ou non

case 'prix':                  // prix remisés du client connecté, appliqués sur les pages du catalogue
    if (empty($_SESSION['cid'])) { flag(false); out(['ok' => false]); }
    $c = client(); $prix = [];
    foreach (db()->query('SELECT id, prix_ttc FROM produits WHERE prix_ttc > 0 AND masque=0')->fetchAll() as $p) { $prix[$p['id']] = round($p['prix_ttc'] * (1 - $c['remise'] / 100), 2); }
    out(['ok' => true, 'remise' => (float)$c['remise'], 'societe' => $c['societe'], 'prix' => $prix]);

case 'deconnexion':
    $_SESSION = []; session_destroy(); flag(false); out(['ok' => true]);

case 'tableau':
    $c = client();
    $dem = db()->prepare('SELECT id, ref, cree_le, statut, type, total, paiement, suivi, lignes FROM demandes WHERE client_id=? ORDER BY id DESC LIMIT 100');
    $dem->execute([$c['id']]); $rows = $dem->fetchAll();
    foreach ($rows as &$r) { $r['lignes'] = json_decode($r['lignes'], true) ?: []; $r['lien'] = 'suivi-commande.html?ref=' . $r['ref'] . '&k=' . $r['suivi']; unset($r['suivi']); }
    unset($r);
    $prix = [];
    foreach (db()->query('SELECT id, prix_ttc FROM produits WHERE prix_ttc > 0 AND masque=0')->fetchAll() as $p) { $prix[$p['id']] = round($p['prix_ttc'] * (1 - $c['remise'] / 100), 2); }
    out(['ok' => true, 'client' => ['societe' => $c['societe'], 'nom' => $c['nom'], 'email' => $c['email'], 'telephone' => $c['telephone'], 'ville' => $c['ville'], 'ice' => $c['ice'],
         'remise' => (float)$c['remise'], 'commercial' => $c['commercial'], 'commercial_wa' => $c['commercial_wa']], 'demandes' => $rows, 'prix' => $prix, 'etapes' => ETAPES]);

case 'recommander':
    require_post(); check_csrf(); $c = client(); throttle('client_recommande', 10, 600);
    $st = db()->prepare('SELECT * FROM demandes WHERE id=? AND client_id=?'); $st->execute([(int)($in['id'] ?? 0), $c['id']]); $o = $st->fetch();
    if (!$o) { fail('Demande introuvable.'); }
    $suivi = token(12);
    db()->prepare("INSERT INTO demandes (cree_le, type, nom, societe, ice, email, telephone, ville, contenu, total, univers, commercial_id, maj_le, suivi, lignes, client_id)
                   VALUES (?, 'commande', ?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      ->execute([now(), $c['nom'], $c['societe'], $c['ice'], $c['email'], $c['telephone'], $c['ville'], "RECOMMANDE de {$o['ref']}\n\n" . $o['contenu'], $o['total'], $o['univers'], $c['commercial_id'], now(), $suivi, $o['lignes'], $c['id']]);
    $id = (int)db()->lastInsertId(); $ref = demande_ref($id);
    db()->prepare('UPDATE demandes SET ref=? WHERE id=?')->execute([$ref, $id]);
    add_etape($id, 'nouveau', 'Recommande depuis l\'espace client', 'client');
    notify("Recommande $ref : {$c['societe']}", "Le client {$c['societe']} recommande le contenu de {$o['ref']}.\n\n" . $o['contenu'], $c['commercial_id'] ? (int)$c['commercial_id'] : null);
    out(['ok' => true, 'ref' => $ref]);

default:
    fail('Action inconnue.', 404);
}
