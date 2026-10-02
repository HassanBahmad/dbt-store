<?php
/* Notification serveur du CMI après chaque paiement : vérifie l'empreinte et met à jour la commande. */
require __DIR__ . '/_lib.php';
require __DIR__ . '/_cmi.php';
header('Content-Type: text/plain; charset=utf-8');
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { http_response_code(405); exit; }
$r = cmi_traiter($_POST);
echo $r === 'invalide' ? 'FAILURE' : ($r === 'refuse' ? 'APPROVED' : 'ACTION=POSTAUTH');
