<?php
/* Tâche quotidienne (cron cPanel) : sauvegarde de la base et e-mail de relance.
   Commande cPanel : php /home/COMPTE/public_html/api/cron.php
   ou par URL : https://shop.dbt.ma/api/cron.php?cle=CLE (clé visible dans Réglages du backoffice). */
require __DIR__ . '/_lib.php';
if (PHP_SAPI !== 'cli') {
    $k = (string)setting('cron_cle', '');
    if ($k === '' || !hash_equals($k, s($_GET['cle'] ?? '', 80))) { fail('Accès refusé.', 403); }
}
$r = sauvegarde();
$n = relances(true);
if (PHP_SAPI === 'cli') { echo "Sauvegarde : {$r}\nRelances : {$n}\n"; exit; }
out(['ok' => true, 'sauvegarde' => $r, 'relances' => $n]);

function sauvegarde(): string {
    $dir = data_dir('sauvegardes');
    $f = $dir . '/dbt-' . gmdate('Y-m-d') . '.sqlite';
    db()->exec('VACUUM INTO ' . db()->quote($f . '.tmp'));
    @rename($f . '.tmp', $f);
    $all = glob($dir . '/dbt-*.sqlite'); sort($all);
    foreach (array_slice($all, 0, max(0, count($all) - 14)) as $old) { @unlink($old); }     // 14 jours conservés
    set_setting('derniere_sauvegarde', now());
    return basename($f);
}
