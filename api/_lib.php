<?php
/* DIGITAL BOX TECHNOLOGIES : socle commun de l'API (base SQLite, sécurité, e-mails, réponses JSON). */
declare(strict_types=1);

/* Données hors de la racine web quand l'hébergement le permet (public_html/../dbt-data), sinon dans /data protégé par .htaccess. */
define('DATA_DIR', (is_dir(__DIR__ . '/../../dbt-data') || is_writable(dirname(__DIR__, 2))) ? dirname(__DIR__, 2) . '/dbt-data' : __DIR__ . '/../data');
const NOTIFY_DEFAULT = 'contact@dbt.ma';
const ETAPES = ['nouveau' => 'Demande reçue', 'devis_envoye' => 'Devis envoyé', 'confirme' => 'Commande confirmée', 'commande_fournisseur' => 'Commandée chez le distributeur',
                'expedie' => 'Expédiée', 'livre' => 'Livrée', 'annule' => 'Annulée'];

function data_dir(string $sub = ''): string {
    $d = DATA_DIR . ($sub ? '/' . $sub : '');
    if (!is_dir($d)) { mkdir($d, 0750, true); }
    if (!file_exists(DATA_DIR . '/.htaccess')) { file_put_contents(DATA_DIR . '/.htaccess', "Require all denied\nDeny from all\n"); }
    if (!file_exists($d . '/index.html')) { file_put_contents($d . '/index.html', ''); }
    return $d;
}

function db(): PDO {
    static $pdo = null;
    if ($pdo) { return $pdo; }
    $pdo = new PDO('sqlite:' . data_dir() . '/dbt.sqlite', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $pdo->exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=4000;');
    $pdo->exec("CREATE TABLE IF NOT EXISTS commerciaux (id INTEGER PRIMARY KEY, nom TEXT NOT NULL, univers TEXT NOT NULL DEFAULT 'tous',
        whatsapp TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', actif INTEGER NOT NULL DEFAULT 1)");
    $pdo->exec("CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY, cree_le TEXT NOT NULL, statut TEXT NOT NULL DEFAULT 'nouveau',
        type TEXT, societe TEXT, ice TEXT, nom TEXT, fonction TEXT, email TEXT, telephone TEXT, ville TEXT, univers TEXT, message TEXT,
        commercial_id INTEGER REFERENCES commerciaux(id) ON DELETE SET NULL, notes TEXT NOT NULL DEFAULT '', maj_le TEXT, ip TEXT)");
    $pdo->exec("CREATE TABLE IF NOT EXISTS demandes (id INTEGER PRIMARY KEY, cree_le TEXT NOT NULL, statut TEXT NOT NULL DEFAULT 'nouveau', type TEXT,
        nom TEXT, societe TEXT, ice TEXT, email TEXT, telephone TEXT, ville TEXT, contenu TEXT, total REAL NOT NULL DEFAULT 0, univers TEXT,
        commercial_id INTEGER REFERENCES commerciaux(id) ON DELETE SET NULL, notes TEXT NOT NULL DEFAULT '', maj_le TEXT, ip TEXT)");
    $pdo->exec("CREATE TABLE IF NOT EXISTS historique (id INTEGER PRIMARY KEY, demande_id INTEGER NOT NULL REFERENCES demandes(id) ON DELETE CASCADE,
        quand TEXT NOT NULL, etape TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', par TEXT NOT NULL DEFAULT '', visible INTEGER NOT NULL DEFAULT 1)");
    $pdo->exec("CREATE TABLE IF NOT EXISTS utilisateurs (id INTEGER PRIMARY KEY, identifiant TEXT NOT NULL UNIQUE, nom TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT 'commercial', commercial_id INTEGER REFERENCES commerciaux(id) ON DELETE SET NULL, hash TEXT NOT NULL DEFAULT '',
        totp TEXT NOT NULL DEFAULT '', reset_hash TEXT NOT NULL DEFAULT '', reset_exp INTEGER NOT NULL DEFAULT 0, actif INTEGER NOT NULL DEFAULT 1, cree_le TEXT, dernier_acces TEXT)");
    $pdo->exec("CREATE TABLE IF NOT EXISTS produits (id TEXT PRIMARY KEY, sku TEXT, nom TEXT, marque TEXT, categorie TEXT, univers TEXT,
        prix_ttc REAL NOT NULL DEFAULT 0, prix_barre REAL NOT NULL DEFAULT 0, dispo TEXT NOT NULL DEFAULT 'Sur commande', en_avant INTEGER NOT NULL DEFAULT 0,
        masque INTEGER NOT NULL DEFAULT 0, maj_le TEXT)");
    $pdo->exec("CREATE TABLE IF NOT EXISTS stats (jour TEXT NOT NULL, type TEXT NOT NULL, cle TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (jour, type, cle))");
    $pdo->exec("CREATE TABLE IF NOT EXISTS avis (id INTEGER PRIMARY KEY, cree_le TEXT NOT NULL, statut TEXT NOT NULL DEFAULT 'nouveau', nom TEXT, societe TEXT, ville TEXT,
        email TEXT, note INTEGER NOT NULL DEFAULT 5, texte TEXT, produit TEXT NOT NULL DEFAULT '', client_id INTEGER, ip TEXT)");
    $pdo->exec("CREATE TABLE IF NOT EXISTS reglages (cle TEXT PRIMARY KEY, valeur TEXT)");
    $pdo->exec("CREATE TABLE IF NOT EXISTS limites (ip TEXT, quoi TEXT, t INTEGER)");
    // évolutions de schéma (versions précédentes)
    $cols = function (string $t) use ($pdo): array { return array_column($pdo->query("PRAGMA table_info($t)")->fetchAll(), 'name'); };
    $add = function (string $t, string $c, string $def) use ($pdo, $cols) { if (!in_array($c, $cols($t), true)) { $pdo->exec("ALTER TABLE $t ADD COLUMN $c $def"); } };
    $add('clients', 'remise', 'REAL NOT NULL DEFAULT 0');
    $add('clients', 'hash', "TEXT NOT NULL DEFAULT ''");
    $add('clients', 'invite_hash', "TEXT NOT NULL DEFAULT ''");
    $add('clients', 'invite_exp', 'INTEGER NOT NULL DEFAULT 0');
    $add('clients', 'dernier_acces', 'TEXT');
    $add('demandes', 'ref', "TEXT NOT NULL DEFAULT ''");
    $add('demandes', 'suivi', "TEXT NOT NULL DEFAULT ''");
    $add('demandes', 'lignes', "TEXT NOT NULL DEFAULT '[]'");
    $add('demandes', 'paiement', "TEXT NOT NULL DEFAULT 'en_attente'");
    $add('demandes', 'fichier', "TEXT NOT NULL DEFAULT ''");
    $add('demandes', 'client_id', 'INTEGER');
    $add('demandes', 'relance_le', 'TEXT');
    $add('produits', 'image', "TEXT NOT NULL DEFAULT ''");
    $add('demandes', 'odoo_id', 'INTEGER');
    $add('demandes', 'odoo_ref', "TEXT NOT NULL DEFAULT ''");
    $add('demandes', 'odoo_token', "TEXT NOT NULL DEFAULT ''");
    $add('demandes', 'odoo_etat', "TEXT NOT NULL DEFAULT ''");
    $add('clients', 'odoo_partner_id', 'INTEGER');
    $pdo->exec("CREATE TABLE IF NOT EXISTS paiements (id INTEGER PRIMARY KEY, demande_id INTEGER NOT NULL REFERENCES demandes(id) ON DELETE CASCADE,
        oid TEXT NOT NULL UNIQUE, montant REAL NOT NULL, statut TEXT NOT NULL DEFAULT 'initie', cree_le TEXT NOT NULL, maj_le TEXT, code TEXT NOT NULL DEFAULT '',
        message TEXT NOT NULL DEFAULT '', autorisation TEXT NOT NULL DEFAULT '', carte TEXT NOT NULL DEFAULT '')");
    $pdo->exec("UPDATE demandes SET statut='confirme' WHERE statut='en_cours'");
    $pdo->exec("UPDATE demandes SET statut='livre' WHERE statut='traite'");
    if (!(int)$pdo->query('SELECT COUNT(*) FROM commerciaux')->fetchColumn()) {
        $seed = json_decode((string)@file_get_contents(__DIR__ . '/commerciaux-defaut.json'), true) ?: [];
        $st = $pdo->prepare('INSERT INTO commerciaux (nom, univers, whatsapp, email) VALUES (?,?,?,?)');
        foreach ($seed as $c) { $st->execute([$c['nom'], $c['univers'], $c['whatsapp'], $c['email'] ?? '']); }
    }
    // ancien compte unique : devient l'administrateur
    $old = $pdo->query("SELECT valeur FROM reglages WHERE cle='admin_hash'")->fetchColumn();
    if ($old && !(int)$pdo->query('SELECT COUNT(*) FROM utilisateurs')->fetchColumn()) {
        $u = $pdo->query("SELECT valeur FROM reglages WHERE cle='admin_user'")->fetchColumn() ?: 'admin';
        $pdo->prepare("INSERT INTO utilisateurs (identifiant, nom, role, hash, cree_le) VALUES (?,?,'admin',?,?)")->execute([$u, $u, $old, now()]);
    }
    sync_produits($pdo);
    return $pdo;
}

/* Catalogue de référence publié avec le site : ajoute les nouveaux produits, sans écraser les prix modifiés dans le backoffice. */
function sync_produits(PDO $pdo): void {
    $f = __DIR__ . '/catalogue-base.json';
    if (!is_file($f)) { return; }
    $mt = (string)filemtime($f);
    $st = $pdo->query("SELECT valeur FROM reglages WHERE cle='catalogue_sync'")->fetchColumn();
    if ($st === $mt) { return; }
    $rows = json_decode((string)file_get_contents($f), true) ?: [];
    $ins = $pdo->prepare('INSERT INTO produits (id, sku, nom, marque, categorie, univers, prix_ttc, prix_barre, dispo, en_avant, maj_le, image) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET sku=excluded.sku, nom=excluded.nom, marque=excluded.marque, categorie=excluded.categorie, univers=excluded.univers, image=excluded.image');
    foreach ($rows as $r) { $ins->execute([$r['id'], $r['sku'], $r['nom'], $r['marque'], $r['categorie'], $r['univers'], (float)$r['prix'], (float)$r['barre'], $r['dispo'], (int)$r['avant'], now(), $r['img']]); }
    $pdo->prepare("INSERT INTO reglages (cle, valeur) VALUES ('catalogue_sync', ?) ON CONFLICT(cle) DO UPDATE SET valeur=excluded.valeur")->execute([$mt]);
}

function setting(string $k, ?string $def = null): ?string {
    $st = db()->prepare('SELECT valeur FROM reglages WHERE cle=?'); $st->execute([$k]);
    $v = $st->fetchColumn(); return $v === false ? $def : (string)$v;
}
function set_setting(string $k, string $v): void {
    db()->prepare('INSERT INTO reglages (cle, valeur) VALUES (?,?) ON CONFLICT(cle) DO UPDATE SET valeur=excluded.valeur')->execute([$k, $v]);
}

function out($data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    if (!headers_sent() && !in_array('Cache-Control', array_map(fn($h) => explode(':', $h)[0], headers_list()), true)) { header('Cache-Control: no-store'); }
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
function fail(string $msg, int $code = 400): void { out(['ok' => false, 'erreur' => $msg], $code); }

function input(): array {
    $raw = file_get_contents('php://input') ?: '';
    if (strlen($raw) > 200000) { fail('Requête trop volumineuse.', 413); }
    $j = json_decode($raw, true);
    return is_array($j) ? $j : $_POST;
}
function s($v, int $max = 300): string { return mb_substr(trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', (string)($v ?? ''))), 0, $max); }
function now(): string { return gmdate('Y-m-d\TH:i:s\Z'); }
function ip(): string { return substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 64); }
function token(int $n = 24): string { return bin2hex(random_bytes($n)); }
function site_url(): string {
    $h = preg_replace('/[^A-Za-z0-9.\-:]/', '', (string)($_SERVER['HTTP_HOST'] ?? 'shop.dbt.ma'));
    $base = rtrim(str_replace('\\', '/', dirname(dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/api/x.php')))), '/');
    return (!empty($_SERVER['HTTPS']) ? 'https://' : 'http://') . $h . $base;
}

/* Limite d'appels par adresse IP : $max actions $quoi sur $sec secondes. */
function throttle(string $quoi, int $max, int $sec): void {
    $d = db(); $t = time();
    $d->prepare('DELETE FROM limites WHERE t < ?')->execute([$t - 86400]);
    $st = $d->prepare('SELECT COUNT(*) FROM limites WHERE ip=? AND quoi=? AND t > ?'); $st->execute([ip(), $quoi, $t - $sec]);
    if ((int)$st->fetchColumn() >= $max) { fail('Trop de tentatives. Réessayez dans quelques minutes.', 429); }
    $d->prepare('INSERT INTO limites (ip, quoi, t) VALUES (?,?,?)')->execute([ip(), $quoi, $t]);
}

function require_post(): void { if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { fail('Méthode non autorisée.', 405); } }

/* Commercial attribué automatiquement selon l'univers demandé. */
function commercial_pour(string $univers): ?int {
    $st = db()->prepare("SELECT id FROM commerciaux WHERE actif=1 AND (univers=? OR univers='tous') ORDER BY univers=? DESC, id LIMIT 1");
    $st->execute([$univers, $univers]); $id = $st->fetchColumn();
    return $id === false ? null : (int)$id;
}

function send_mail(string $to, string $sujet, string $texte): bool {
    if (!$to || !filter_var($to, FILTER_VALIDATE_EMAIL) || !function_exists('mail')) { return false; }
    $dom = preg_replace('/^(www|shop)\./', '', (string)($_SERVER['HTTP_HOST'] ?? 'dbt.ma'));
    $h = "From: DIGITAL BOX TECHNOLOGIES <no-reply@$dom>\r\nReply-To: " . setting('email_notification', NOTIFY_DEFAULT) . "\r\nContent-Type: text/plain; charset=UTF-8";
    return @mail($to, '=?UTF-8?B?' . base64_encode($sujet) . '?=', $texte . "\n\n--\nDIGITAL BOX TECHNOLOGIES\n05 37 68 09 51 - contact@dbt.ma", $h);
}
function notify(string $sujet, string $texte, ?int $commercial_id = null): void {
    send_mail((string)setting('email_notification', NOTIFY_DEFAULT), $sujet, $texte);
    if ($commercial_id) {
        $st = db()->prepare('SELECT email FROM commerciaux WHERE id=? AND actif=1'); $st->execute([$commercial_id]);
        $e = (string)$st->fetchColumn();
        if ($e && $e !== setting('email_notification', NOTIFY_DEFAULT)) { send_mail($e, $sujet, $texte); }
    }
}

/* Numérotation lisible des demandes : D-2026-00012 */
function demande_ref(int $id): string { return 'D-' . gmdate('Y') . '-' . str_pad((string)$id, 5, '0', STR_PAD_LEFT); }

function add_etape(int $demande_id, string $etape, string $note = '', string $par = '', int $visible = 1): void {
    db()->prepare('INSERT INTO historique (demande_id, quand, etape, note, par, visible) VALUES (?,?,?,?,?,?)')->execute([$demande_id, now(), $etape, $note, $par, $visible]);
}

/* Statistiques agrégées par jour (aucune donnée personnelle). */
function stat_inc(string $type, string $cle, int $n = 1): void {
    $cle = mb_substr(mb_strtolower(trim($cle)), 0, 120);
    if ($cle === '') { return; }
    db()->prepare('INSERT INTO stats (jour, type, cle, n) VALUES (?,?,?,?) ON CONFLICT(jour, type, cle) DO UPDATE SET n=n+excluded.n')->execute([gmdate('Y-m-d'), $type, $cle, $n]);
}

/* TOTP (double authentification, compatible Google Authenticator / Microsoft Authenticator). */
function b32_decode(string $s): string {
    $a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; $s = strtoupper(preg_replace('/[^A-Za-z2-7]/', '', $s)); $bits = ''; $out = '';
    foreach (str_split($s) as $c) { $bits .= str_pad(decbin(strpos($a, $c)), 5, '0', STR_PAD_LEFT); }
    foreach (str_split($bits, 8) as $b) { if (strlen($b) === 8) { $out .= chr(bindec($b)); } }
    return $out;
}
function b32_secret(): string { $a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; $s = ''; for ($i = 0; $i < 32; $i++) { $s .= $a[random_int(0, 31)]; } return $s; }
function totp_ok(string $secret, string $code): bool {
    $code = preg_replace('/\D/', '', $code); if (strlen($code) !== 6) { return false; }
    $k = b32_decode($secret); $t = intdiv(time(), 30);
    for ($i = -1; $i <= 1; $i++) {
        $h = hash_hmac('sha1', pack('N*', 0) . pack('N*', $t + $i), $k, true); $o = ord($h[19]) & 15;
        $v = ((ord($h[$o]) & 127) << 24 | ord($h[$o + 1]) << 16 | ord($h[$o + 2]) << 8 | ord($h[$o + 3])) % 1000000;
        if (hash_equals(str_pad((string)$v, 6, '0', STR_PAD_LEFT), $code)) { return true; }
    }
    return false;
}

/* Sessions (backoffice et espace client, cookies distincts). */
function start_session(string $name): void {
    if (session_status() === PHP_SESSION_ACTIVE) { return; }
    session_name($name);
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => !empty($_SERVER['HTTPS']), 'httponly' => true, 'samesite' => 'Lax']);
    session_start();
    if (!empty($_SESSION['vu']) && time() - $_SESSION['vu'] > 8 * 3600) { $_SESSION = []; session_regenerate_id(true); }
    $_SESSION['vu'] = time();
    if (empty($_SESSION['csrf'])) { $_SESSION['csrf'] = token(); }
}
function admin_session(): void { start_session('dbtadmin'); }
function check_csrf(): void { if (!hash_equals((string)($_SESSION['csrf'] ?? ''), (string)($_SERVER['HTTP_X_CSRF'] ?? ''))) { fail('Jeton de sécurité invalide.', 403); } }

/* Utilisateur connecté au backoffice : ['id','identifiant','role','commercial_id', ...] */
function me(): ?array {
    if (empty($_SESSION['uid'])) { return null; }
    static $u = null;
    if ($u === null) {
        $st = db()->prepare('SELECT id, identifiant, nom, email, role, commercial_id, totp != \'\' AS a2f FROM utilisateurs WHERE id=? AND actif=1'); $st->execute([$_SESSION['uid']]);
        $u = $st->fetch() ?: false;
    }
    return $u ?: null;
}
function require_admin(bool $csrf = true, bool $adminOnly = false): array {
    admin_session();
    $u = me();
    if (!$u) { fail('Session expirée, reconnectez-vous.', 401); }
    if ($csrf) { check_csrf(); }
    if ($adminOnly && $u['role'] !== 'admin') { fail('Action réservée à l\'administrateur.', 403); }
    return $u;
}
/* Restriction des listes pour un commercial : il ne voit que ses clients et ses demandes. */
function scope(array $u, string $alias = ''): array {
    if ($u['role'] === 'admin') { return ['1=1', []]; }
    return [($alias ? "$alias." : '') . 'commercial_id = ?', [(int)$u['commercial_id']]];
}

/* Éléments à relancer : demandes sans réponse depuis 24 h, devis envoyés sans retour depuis 3 jours, comptes pro en attente depuis 24 h. */
function a_relancer(?array $u = null): array {
    [$w, $p] = $u ? scope($u) : ['1=1', []];
    $h24 = gmdate('Y-m-d\TH:i:s\Z', time() - 86400); $j3 = gmdate('Y-m-d\TH:i:s\Z', time() - 3 * 86400);
    $q = function (string $sql, array $args) { $st = db()->prepare($sql); $st->execute($args); return $st->fetchAll(); };
    $out = [];
    foreach ($q("SELECT id, ref, societe, nom, cree_le AS depuis, commercial_id FROM demandes WHERE statut='nouveau' AND cree_le < ? AND $w ORDER BY id", array_merge([$h24], $p)) as $r) {
        $out[] = ['quoi' => 'demande', 'id' => $r['id'], 'titre' => ($r['ref'] ?: '#' . $r['id']) . ' - ' . ($r['societe'] ?: $r['nom']), 'raison' => 'Demande sans réponse depuis plus de 24 h', 'depuis' => $r['depuis'], 'commercial_id' => $r['commercial_id']];
    }
    foreach ($q("SELECT id, ref, societe, nom, maj_le AS depuis, commercial_id FROM demandes WHERE statut='devis_envoye' AND maj_le < ? AND $w ORDER BY id", array_merge([$j3], $p)) as $r) {
        $out[] = ['quoi' => 'demande', 'id' => $r['id'], 'titre' => ($r['ref'] ?: '#' . $r['id']) . ' - ' . ($r['societe'] ?: $r['nom']), 'raison' => 'Devis envoyé sans retour depuis 3 jours', 'depuis' => $r['depuis'], 'commercial_id' => $r['commercial_id']];
    }
    foreach ($q("SELECT id, societe, nom, cree_le AS depuis, commercial_id FROM clients WHERE statut='nouveau' AND cree_le < ? AND $w ORDER BY id", array_merge([$h24], $p)) as $r) {
        $out[] = ['quoi' => 'client', 'id' => $r['id'], 'titre' => $r['societe'] . ' (' . $r['nom'] . ')', 'raison' => 'Compte pro en attente de validation', 'depuis' => $r['depuis'], 'commercial_id' => $r['commercial_id']];
    }
    return $out;
}
function relances(bool $send): int {
    $all = a_relancer();
    if (!$send || !$all) { return count($all); }
    $txt = fn(array $l) => implode("\n", array_map(fn($x) => "- {$x['titre']} : {$x['raison']}", $l));
    send_mail((string)setting('email_notification', NOTIFY_DEFAULT), 'À relancer aujourd\'hui (' . count($all) . ')', "Éléments en attente dans le backoffice :\n\n" . $txt($all));
    foreach (db()->query("SELECT id, email FROM commerciaux WHERE actif=1 AND email != ''")->fetchAll() as $c) {
        $mine = array_values(array_filter($all, fn($x) => (int)$x['commercial_id'] === (int)$c['id']));
        if ($mine && $c['email'] !== setting('email_notification', NOTIFY_DEFAULT)) { send_mail($c['email'], 'Vos relances du jour (' . count($mine) . ')', $txt($mine)); }
    }
    return count($all);
}
