<?php
/* Enregistrement des commandes, demandes de prix pro et configurations serveur envoyées depuis le site.
   Accepte du JSON, ou un formulaire multipart avec un bon de commande PDF (champ « bc »). */
require __DIR__ . '/_lib.php';
require_post();
$in = input();
if (s($in['site_web'] ?? '') !== '') { out(['ok' => true]); }
throttle('demande', 10, 600);

$type = s($in['type'] ?? '', 20);
if (!in_array($type, ['commande', 'devis', 'configurateur'], true)) { fail('Type de demande inconnu.'); }
$email = strtolower(s($in['email'] ?? '', 160));
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) { fail('Adresse e-mail invalide.'); }
$contenu = s($in['contenu'] ?? '', 8000);
if ($contenu === '') { fail('Demande vide.'); }
$univers = in_array($in['univers'] ?? '', ['postes', 'infra'], true) ? $in['univers'] : 'tous';

// lignes structurées (pour la recommande depuis l'espace client)
$lg = $in['lignes'] ?? [];
if (is_string($lg)) { $lg = json_decode($lg, true) ?: []; }
$lignes = [];
foreach (array_slice((array)$lg, 0, 100) as $l) {
    if (!is_array($l)) { continue; }
    $lignes[] = ['id' => s($l['id'] ?? '', 160), 'sku' => s($l['sku'] ?? '', 60), 'nom' => s($l['nom'] ?? ($l['name'] ?? ''), 200), 'qte' => max(1, min(9999, (int)($l['qte'] ?? ($l['qty'] ?? 1)))), 'prix' => max(0, (float)($l['prix'] ?? ($l['price'] ?? 0)))];
}

// bon de commande joint (PDF ou image, 8 Mo max)
$fichier = '';
if (!empty($_FILES['bc']) && is_uploaded_file($_FILES['bc']['tmp_name'] ?? '')) {
    if ($_FILES['bc']['size'] > 8 * 1024 * 1024) { fail('Fichier trop volumineux (8 Mo maximum).'); }
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($_FILES['bc']['tmp_name']);
    $ext = ['application/pdf' => 'pdf', 'image/jpeg' => 'jpg', 'image/png' => 'png'][$mime] ?? null;
    if (!$ext) { fail('Bon de commande : formats acceptés PDF, JPG ou PNG.'); }
    $fichier = gmdate('Ymd-His') . '-' . token(6) . '.' . $ext;
    move_uploaded_file($_FILES['bc']['tmp_name'], data_dir('fichiers') . '/' . $fichier);
}

// client connecté à son espace pro ?
$client_id = null;
if (!empty($_COOKIE['dbtclient'])) { start_session('dbtclient'); $client_id = !empty($_SESSION['cid']) ? (int)$_SESSION['cid'] : null; }

$d = db();
$st = $d->prepare('SELECT id, commercial_id FROM clients WHERE ' . ($client_id ? 'id=?' : "email=? AND statut != 'refuse'") . ' ORDER BY id DESC LIMIT 1');
$st->execute([$client_id ?: $email]); $cl = $st->fetch();
$com = ($cl && $cl['commercial_id']) ? (int)$cl['commercial_id'] : commercial_pour($univers);
$suivi = token(12);

$d->prepare('INSERT INTO demandes (cree_le, type, nom, societe, ice, email, telephone, ville, contenu, total, univers, commercial_id, ip, maj_le, suivi, lignes, fichier, client_id)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
  ->execute([now(), $type, s($in['nom'] ?? '', 120), s($in['societe'] ?? '', 160), preg_replace('/\D/', '', s($in['ice'] ?? '', 30)), $email,
             s($in['telephone'] ?? '', 40), s($in['ville'] ?? '', 80), $contenu, max(0, (float)($in['total'] ?? 0)), $univers, $com, ip(), now(),
             $suivi, json_encode($lignes, JSON_UNESCAPED_UNICODE), $fichier, $cl ? (int)$cl['id'] : null]);
$id = (int)$d->lastInsertId();
$ref = demande_ref($id);
$d->prepare('UPDATE demandes SET ref=? WHERE id=?')->execute([$ref, $id]);
add_etape($id, 'nouveau', '', 'site');
foreach ($lignes as $l) { stat_inc('demande_produit', $l['nom']); }

$lien = site_url() . '/suivi-commande.html?ref=' . $ref . '&k=' . $suivi;
$lib = ['commande' => 'Nouvelle commande', 'devis' => 'Nouvelle demande de prix pro', 'configurateur' => 'Nouvelle configuration serveur'][$type];
notify("$lib $ref : " . (s($in['societe'] ?? '') ?: s($in['nom'] ?? '')), $contenu . ($fichier ? "\n\nBon de commande joint, à télécharger depuis le backoffice." : ''), $com);
if ($email) {
    send_mail($email, "Votre demande $ref est bien reçue", "Bonjour,\n\nNous avons bien reçu votre demande $ref. Un commercial vous répond sous 24 heures ouvrées.\n\nSuivez son avancement à tout moment :\n$lien\n\nMerci de votre confiance.");
}
// devis créé automatiquement dans Odoo (si activé), après la réponse au client
if (setting('odoo_auto', '0') === '1') {
    require __DIR__ . '/_odoo.php';
    if (odoo_pret()) {
        header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store');
        echo json_encode(['ok' => true, 'ref' => $ref, 'suivi' => $lien], JSON_UNESCAPED_UNICODE);
        if (function_exists('fastcgi_finish_request')) { fastcgi_finish_request(); } else { @ob_end_flush(); @flush(); }
        try { $l = odoo_devis($id); add_etape($id, 'nouveau', 'Devis ' . $l['odoo_ref'] . ' créé dans Odoo', 'odoo', 0); }
        catch (Throwable $e) { add_etape($id, 'nouveau', 'Création du devis Odoo impossible : ' . mb_substr($e->getMessage(), 0, 200), 'odoo', 0); }
        exit;
    }
}
out(['ok' => true, 'ref' => $ref, 'suivi' => $lien]);
