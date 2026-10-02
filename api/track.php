<?php
/* Mesure d'audience anonyme : pages, produits vus, recherches (avec ou sans résultat). Aucun cookie, aucune donnée personnelle. */
require __DIR__ . '/_lib.php';
require_post();
$in = input();
throttle('track', 120, 600);
$t = s($in['t'] ?? '', 20); $k = s($in['k'] ?? '', 120);
if (in_array($t, ['page', 'produit', 'recherche', 'recherche_vide', 'whatsapp', 'panier'], true) && $k !== '') { stat_inc($t, $k); }
http_response_code(204); exit;
