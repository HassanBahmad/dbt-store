<?php
/* Avis clients : dépôt depuis le site (publié après validation dans le backoffice) et lecture des avis publiés. */
require __DIR__ . '/_lib.php';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    $in = input();
    if (s($in['site_web'] ?? '') !== '') { out(['ok' => true]); }
    throttle('avis', 3, 3600);
    $nom = s($in['nom'] ?? '', 80); $texte = s($in['texte'] ?? '', 1500); $note = max(1, min(5, (int)($in['note'] ?? 5)));
    $email = strtolower(s($in['email'] ?? '', 160));
    if ($nom === '' || mb_strlen($texte) < 15) { fail('Indiquez votre nom et un avis d\'au moins 15 caractères.'); }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) { fail('Adresse e-mail invalide (elle n\'est pas publiée).'); }
    $cid = db()->prepare("SELECT id FROM clients WHERE email=? AND statut='valide' LIMIT 1"); $cid->execute([$email]); $cid = $cid->fetchColumn() ?: null;
    db()->prepare('INSERT INTO avis (cree_le, nom, societe, ville, email, note, texte, produit, client_id, ip) VALUES (?,?,?,?,?,?,?,?,?,?)')
      ->execute([now(), $nom, s($in['societe'] ?? '', 120), s($in['ville'] ?? '', 80), $email, $note, $texte, s($in['produit'] ?? '', 160), $cid, ip()]);
    notify('Nouvel avis client à modérer', "$nom ($note/5) : $texte");
    out(['ok' => true]);
}
header('Cache-Control: public, max-age=300');
$p = s($_GET['produit'] ?? '', 160);
$st = db()->prepare("SELECT cree_le, nom, societe, ville, note, texte, client_id IS NOT NULL AS client FROM avis WHERE statut='publie'" . ($p ? ' AND produit=?' : '') . ' ORDER BY id DESC LIMIT 30');
$st->execute($p ? [$p] : []);
$rows = $st->fetchAll();
$all = db()->query("SELECT COUNT(*) AS n, AVG(note) AS m FROM avis WHERE statut='publie'")->fetch();
out(['ok' => true, 'avis' => $rows, 'total' => (int)$all['n'], 'moyenne' => $all['n'] ? round((float)$all['m'], 1) : 0]);
