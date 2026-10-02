<?php
/* Données publiques : commerciaux joignables sur WhatsApp, par univers. */
require __DIR__ . '/_lib.php';
require __DIR__ . '/_cmi.php';
header('Cache-Control: public, max-age=300');
$rows = db()->query("SELECT nom, univers, whatsapp FROM commerciaux WHERE actif=1 AND whatsapp != '' ORDER BY univers, id")->fetchAll();
out(['ok' => true, 'commerciaux' => $rows, 'carte' => cmi_pret()]);
