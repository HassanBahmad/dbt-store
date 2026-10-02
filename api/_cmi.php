<?php
/* Paiement par carte bancaire via le CMI (Centre Monétique Interbancaire), page de paiement hébergée 3D Secure.
   Réglages : cmi_actif, cmi_mode (test ou prod), cmi_clientid, cmi_storekey. */
const CMI_URL = ['test' => 'https://testpayment.cmi.co.ma/fim/est3Dgate', 'prod' => 'https://payment.cmi.co.ma/fim/est3Dgate'];

function cmi_pret(): bool { return setting('cmi_actif', '0') === '1' && setting('cmi_clientid', '') !== '' && setting('cmi_storekey', '') !== ''; }

/* Empreinte « ver3 » : paramètres triés par nom, valeurs échappées, séparées par « | », clé du magasin en fin, SHA-512 puis base64. */
function cmi_hash(array $p, string $storekey): string {
    $keys = array_keys($p); natcasesort($keys);
    $esc = fn($v) => str_replace('|', '\\|', str_replace('\\', '\\\\', trim((string)$v)));
    $s = '';
    foreach ($keys as $k) { $lk = strtolower((string)$k); if ($lk === 'hash' || $lk === 'encoding') { continue; } $s .= $esc($p[$k]) . '|'; }
    return base64_encode(pack('H*', hash('sha512', $s . $esc($storekey))));
}

/* Demande payable par carte : montant fixé par DIGITAL BOX TECHNOLOGIES, non encore payée. */
function cmi_payable(array $d): bool {
    return cmi_pret() && (float)$d['total'] > 0 && $d['paiement'] !== 'paye' && !in_array($d['statut'], ['nouveau', 'annule'], true);
}
function cmi_lien(array $d): string { return site_url() . '/api/paiement.php?ref=' . rawurlencode($d['ref']) . '&k=' . rawurlencode($d['suivi']); }

/* Traite la réponse du CMI (notification serveur ou retour navigateur). Renvoie 'paye', 'refuse', 'deja' ou 'invalide'. */
function cmi_traiter(array $post): string {
    $hash = (string)($post['HASH'] ?? $post['hash'] ?? '');
    if ($hash === '' || !hash_equals(cmi_hash($post, (string)setting('cmi_storekey', '')), $hash)) { return 'invalide'; }
    $st = db()->prepare('SELECT p.*, d.ref, d.email, d.nom, d.societe, d.commercial_id, d.statut AS etape FROM paiements p JOIN demandes d ON d.id=p.demande_id WHERE p.oid=?');
    $st->execute([s($post['oid'] ?? '', 80)]); $p = $st->fetch();
    if (!$p) { return 'invalide'; }
    if ($p['statut'] === 'paye') { return 'deja'; }
    $ok = ($post['ProcReturnCode'] ?? '') === '00' && strcasecmp((string)($post['Response'] ?? ''), 'Approved') === 0
          && abs((float)str_replace(',', '.', (string)($post['amount'] ?? 0)) - (float)$p['montant']) < 0.01;
    db()->prepare('UPDATE paiements SET statut=?, maj_le=?, code=?, message=?, autorisation=?, carte=? WHERE id=?')
      ->execute([$ok ? 'paye' : 'refuse', now(), s($post['ProcReturnCode'] ?? '', 10), s($post['ErrMsg'] ?? ($post['Response'] ?? ''), 200),
                 s($post['AuthCode'] ?? '', 20), s($post['MaskedPan'] ?? '', 30), $p['id']]);
    if ($ok) {
        $m = number_format((float)$p['montant'], 2, ',', ' ') . ' DH';
        db()->prepare("UPDATE demandes SET paiement='paye', maj_le=? WHERE id=?")->execute([now(), $p['demande_id']]);
        add_etape((int)$p['demande_id'], $p['etape'], "Paiement par carte reçu : $m", 'cmi');
        notify("Paiement carte reçu {$p['ref']} : $m", "La demande {$p['ref']} (" . ($p['societe'] ?: $p['nom']) . ") a été payée par carte : $m.\nAutorisation : " . s($post['AuthCode'] ?? '', 20), $p['commercial_id'] ? (int)$p['commercial_id'] : null);
        if ($p['email']) { send_mail($p['email'], "Paiement reçu pour votre commande {$p['ref']}", "Bonjour,\n\nNous avons bien reçu votre paiement de $m pour la commande {$p['ref']}. Merci.\n\nVotre commercial vous confirme la livraison très prochainement."); }
    }
    return $ok ? 'paye' : 'refuse';
}
