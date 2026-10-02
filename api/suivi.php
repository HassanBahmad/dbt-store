<?php
/* Suivi public d'une demande : référence + clé de suivi reçue par le client. */
require __DIR__ . '/_lib.php';
require __DIR__ . '/_odoo.php';
require __DIR__ . '/_cmi.php';
throttle('suivi', 30, 600);
$ref = strtoupper(s($_GET['ref'] ?? '', 30)); $k = s($_GET['k'] ?? '', 64);
if ($ref === '' || $k === '') { fail('Indiquez la référence et la clé de suivi.'); }
$st = db()->prepare('SELECT d.id, d.ref, d.cree_le, d.statut, d.type, d.paiement, d.suivi, d.total, d.odoo_id, c.nom AS commercial, c.whatsapp FROM demandes d LEFT JOIN commerciaux c ON c.id=d.commercial_id WHERE d.ref=?');
$st->execute([$ref]); $d = $st->fetch();
if (!$d || !hash_equals($d['suivi'], $k)) { usleep(300000); fail('Demande introuvable. Vérifiez le lien reçu par e-mail.', 404); }
$h = db()->prepare('SELECT quand, etape, note FROM historique WHERE demande_id=? AND visible=1 ORDER BY id'); $h->execute([$d['id']]);
out(['ok' => true, 'ref' => $d['ref'], 'cree_le' => $d['cree_le'], 'statut' => $d['statut'], 'type' => $d['type'], 'paiement' => $d['paiement'],
     'etapes' => ETAPES, 'historique' => $h->fetchAll(), 'commercial' => $d['commercial'], 'whatsapp' => $d['whatsapp'],
     'total' => (float)$d['total'], 'payer' => cmi_payable($d) ? cmi_lien($d) : '', 'devis' => ($d['odoo_id'] && odoo_pret()) ? (odoo_liens((int)$d['id'])['lien_client'] ?? '') : '']);
