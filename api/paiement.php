<?php
/* Paiement par carte : redirection vers la page sécurisée du CMI, puis retour du client. */
require __DIR__ . '/_lib.php';
require __DIR__ . '/_cmi.php';
$ref = strtoupper(s($_GET['ref'] ?? '', 30)); $k = s($_GET['k'] ?? '', 64);
$st = db()->prepare('SELECT * FROM demandes WHERE ref=?'); $st->execute([$ref]); $d = $st->fetch();
$suivi = site_url() . '/suivi-commande.html?ref=' . rawurlencode($ref) . '&k=' . rawurlencode($k);
if (!$d || $k === '' || !hash_equals($d['suivi'], $k)) { http_response_code(404); exit('Lien de paiement invalide.'); }

// retour du client après la page CMI (okUrl / failUrl)
if (isset($_GET['retour'])) {
    $r = ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' ? cmi_traiter($_POST) : '';
    $res = in_array($r, ['paye', 'deja'], true) ? 'ok' : ($_GET['retour'] === 'ok' ? 'attente' : 'ko');
    header('Location: ' . $suivi . '&paiement=' . $res, true, 303); exit;
}

if (!cmi_payable($d)) { header('Location: ' . $suivi, true, 303); exit; }
throttle('paiement', 10, 600);
$n = (int)db()->query('SELECT COUNT(*) FROM paiements WHERE demande_id=' . (int)$d['id'])->fetchColumn() + 1;
$oid = $d['ref'] . '-' . $n;
$montant = number_format((float)$d['total'], 2, '.', '');
db()->prepare('INSERT INTO paiements (demande_id, oid, montant, cree_le) VALUES (?,?,?,?)')->execute([$d['id'], $oid, (float)$montant, now()]);
$retour = site_url() . '/api/paiement.php?ref=' . rawurlencode($ref) . '&k=' . rawurlencode($k) . '&retour=';
$p = ['clientid' => setting('cmi_clientid'), 'storetype' => '3D_PAY_HOSTING', 'TranType' => 'PreAuth', 'amount' => $montant, 'currency' => '504',
      'oid' => $oid, 'okUrl' => $retour . 'ok', 'failUrl' => $retour . 'ko', 'callbackUrl' => site_url() . '/api/cmi-callback.php', 'shopurl' => site_url() . '/',
      'lang' => 'fr', 'rnd' => str_replace('.', '', (string)microtime(true)), 'hashAlgorithm' => 'ver3', 'encoding' => 'UTF-8', 'refreshtime' => '5', 'AutoRedirect' => 'true',
      'BillToName' => mb_substr($d['nom'] ?: $d['societe'], 0, 60), 'BillToCompany' => mb_substr((string)$d['societe'], 0, 60), 'email' => (string)$d['email'], 'tel' => (string)$d['telephone']];
$p['HASH'] = cmi_hash($p, (string)setting('cmi_storekey'));
$url = CMI_URL[setting('cmi_mode', 'test') === 'prod' ? 'prod' : 'test'];
header('Content-Type: text/html; charset=utf-8'); header('Cache-Control: no-store'); header('Referrer-Policy: no-referrer');
$e = fn($v) => htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
?><!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Paiement sécurisé - DIGITAL BOX TECHNOLOGIES</title>
<style>body{margin:0;font-family:system-ui,sans-serif;background:#F5F8FC;color:#0A1F3D;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px}
.c{background:#fff;border:1px solid #DDE6F1;border-top:4px solid #0255B3;border-radius:12px;padding:28px;max-width:420px;width:100%;text-align:center}
h1{font-size:1.25rem;margin:0 0 8px}p{color:#34445C;margin:0 0 18px}b{font-size:1.5rem}button{background:#0255B3;color:#fff;border:0;border-radius:8px;padding:12px 18px;font-weight:700;font-size:1rem;cursor:pointer}</style></head>
<body><form class="c" id="f" method="post" action="<?= $e($url) ?>">
<img src="../assets/img/logo-dbt-h.svg" alt="DIGITAL BOX TECHNOLOGIES" height="40"><h1>Paiement sécurisé par carte</h1>
<p>Commande <?= $e($d['ref']) ?><br><b><?= $e(number_format((float)$montant, 2, ',', ' ')) ?> DH</b></p>
<p>Vous allez être redirigé vers la page sécurisée du CMI (3D Secure).</p>
<?php foreach ($p as $k2 => $v) { echo '<input type="hidden" name="' . $e($k2) . '" value="' . $e($v) . '">'; } ?>
<button type="submit">Payer maintenant</button></form>
<script>setTimeout(function(){document.getElementById('f').submit();},800);</script></body></html>
