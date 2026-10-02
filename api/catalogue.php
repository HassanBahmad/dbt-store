<?php
/* Prix et disponibilités à jour (modifiés dans le backoffice), appliqués par le site au chargement des pages. */
require __DIR__ . '/_lib.php';
header('Cache-Control: public, max-age=120');
$rows = db()->query('SELECT id, prix_ttc, prix_barre, dispo, masque FROM produits')->fetchAll();
$o = [];
foreach ($rows as $r) { $o[$r['id']] = [round((float)$r['prix_ttc'], 2), round((float)$r['prix_barre'], 2), $r['dispo'], (int)$r['masque']]; }
out(['ok' => true, 'p' => $o]);
