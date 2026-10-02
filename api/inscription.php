<?php
/* Inscription d'un client professionnel (compte pro). */
require __DIR__ . '/_lib.php';
require_post();
$in = input();
if (s($in['site_web'] ?? '') !== '') { out(['ok' => true]); }              // piège à robots
throttle('inscription', 5, 600);

$types = ['entreprise' => 'Entreprise', 'administration' => 'Administration ou établissement public', 'revendeur' => 'Revendeur ou intégrateur', 'association' => 'Association ou ONG'];
$type = s($in['type'] ?? '', 30);
$c = [
    'type' => array_key_exists($type, $types) ? $type : 'entreprise',
    'societe' => s($in['societe'] ?? '', 160), 'ice' => preg_replace('/\D/', '', s($in['ice'] ?? '', 30)),
    'nom' => s($in['nom'] ?? '', 120), 'fonction' => s($in['fonction'] ?? '', 120),
    'email' => strtolower(s($in['email'] ?? '', 160)), 'telephone' => s($in['telephone'] ?? '', 40),
    'ville' => s($in['ville'] ?? '', 80), 'message' => s($in['message'] ?? '', 2000),
];
$univ = array_values(array_intersect((array)($in['univers'] ?? []), ['postes', 'infra']));
$c['univers'] = implode(',', $univ ?: ['postes', 'infra']);

if ($c['societe'] === '' || $c['nom'] === '') { fail('Indiquez le nom de votre organisme et votre nom.'); }
if (!filter_var($c['email'], FILTER_VALIDATE_EMAIL)) { fail('Adresse e-mail invalide.'); }
if (!preg_match('/^\+?[0-9 .\-()]{8,20}$/', $c['telephone'])) { fail('Numéro de téléphone invalide.'); }
if ($c['ice'] !== '' && strlen($c['ice']) !== 15) { fail("L'ICE comporte 15 chiffres."); }
if (in_array($c['type'], ['entreprise', 'revendeur'], true) && $c['ice'] === '') { fail("L'ICE est demandé pour les entreprises et revendeurs."); }
if (empty($in['consentement'])) { fail("Merci d'accepter le traitement de vos données."); }

$d = db();
$st = $d->prepare("SELECT id FROM clients WHERE email=? AND statut != 'refuse'"); $st->execute([$c['email']]);
if ($st->fetchColumn()) { out(['ok' => true, 'deja' => true]); }

$com = commercial_pour(count($univ) === 1 ? $univ[0] : 'tous');
$d->prepare('INSERT INTO clients (cree_le, type, societe, ice, nom, fonction, email, telephone, ville, univers, message, commercial_id, ip, maj_le)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
  ->execute([now(), $c['type'], $c['societe'], $c['ice'], $c['nom'], $c['fonction'], $c['email'], $c['telephone'], $c['ville'], $c['univers'], $c['message'], $com, ip(), now()]);

notify('Nouvelle inscription compte pro : ' . $c['societe'],
    "Une nouvelle demande de compte pro est à valider dans le backoffice.\n\n" .
    "Organisme : {$c['societe']} ({$types[$c['type']]})\nICE : {$c['ice']}\nContact : {$c['nom']}, {$c['fonction']}\nE-mail : {$c['email']}\nTéléphone : {$c['telephone']}\nVille : {$c['ville']}\n\n{$c['message']}");
out(['ok' => true]);
