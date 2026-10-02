<?php
/* Connexion Odoo (API externe JSON-RPC) : clients, devis, confirmation, factures et paiements.
   Réglages : odoo_url, odoo_db, odoo_user, odoo_key (clé API Odoo de l'utilisateur), odoo_auto, odoo_prix_ht. */

function odoo_pret(): bool { return setting('odoo_url', '') !== '' && setting('odoo_db', '') !== '' && setting('odoo_user', '') !== '' && setting('odoo_key', '') !== ''; }
function odoo_base(): string { return rtrim((string)setting('odoo_url', ''), '/'); }

function odoo_rpc(string $service, string $method, array $args) {
    $ch = curl_init(odoo_base() . '/jsonrpc');
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 25, CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode(['jsonrpc' => '2.0', 'method' => 'call', 'params' => ['service' => $service, 'method' => $method, 'args' => $args], 'id' => random_int(1, 999999)])]);
    $raw = curl_exec($ch); $err = curl_error($ch); $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch);
    if ($raw === false) { throw new RuntimeException('Odoo injoignable : ' . $err); }
    $j = json_decode((string)$raw, true);
    if (!is_array($j)) { throw new RuntimeException("Réponse Odoo illisible (HTTP $code). Vérifiez l'adresse Odoo."); }
    if (isset($j['error'])) {
        $m = $j['error']['data']['message'] ?? $j['error']['message'] ?? 'erreur inconnue';
        throw new RuntimeException('Odoo : ' . mb_substr((string)$m, 0, 300));
    }
    return $j['result'] ?? null;
}
function odoo_uid(): int {
    static $uid = null;
    if ($uid) { return $uid; }
    if (!odoo_pret()) { throw new RuntimeException('Odoo n\'est pas encore connecté (Réglages).'); }
    $uid = odoo_rpc('common', 'authenticate', [setting('odoo_db'), setting('odoo_user'), setting('odoo_key'), new stdClass()]);
    if (!$uid) { throw new RuntimeException('Odoo refuse les identifiants : vérifiez la base, l\'utilisateur et la clé API.'); }
    return (int)$uid;
}
function odoo(string $model, string $method, array $args = [], array $kw = []) {
    return odoo_rpc('object', 'execute_kw', [setting('odoo_db'), odoo_uid(), setting('odoo_key'), $model, $method, $args, (object)$kw]);
}
function odoo_test(): array {
    $v = odoo_rpc('common', 'version', []);
    $uid = odoo_uid();
    $u = odoo('res.users', 'read', [[$uid], ['name']]);
    $c = odoo('res.company', 'search_read', [[]], ['fields' => ['name'], 'limit' => 1]);
    return ['version' => $v['server_version'] ?? '?', 'utilisateur' => $u[0]['name'] ?? '', 'societe' => $c[0]['name'] ?? ''];
}

/* Client Odoo : recherche par e-mail, sinon création (société + ICE en référence interne). */
function odoo_partenaire(array $d): int {
    if (!empty($d['client_id'])) {
        $st = db()->prepare('SELECT odoo_partner_id FROM clients WHERE id=?'); $st->execute([$d['client_id']]);
        $pid = (int)$st->fetchColumn();
        if ($pid && odoo('res.partner', 'search_count', [[['id', '=', $pid]]])) { return $pid; }
    }
    if ($d['email']) {
        $r = odoo('res.partner', 'search', [[['email', '=ilike', $d['email']]]], ['limit' => 1, 'order' => 'is_company desc, id asc']);
        if ($r) { $pid = (int)$r[0]; }
    }
    if (empty($pid)) {
        $pays = odoo('res.country', 'search', [[['code', '=', 'MA']]], ['limit' => 1]);
        $v = ['name' => $d['societe'] ?: $d['nom'], 'is_company' => (bool)$d['societe'], 'email' => $d['email'] ?: false, 'phone' => $d['telephone'] ?: false,
              'city' => $d['ville'] ?: false, 'country_id' => $pays ? (int)$pays[0] : false, 'ref' => $d['ice'] ? 'ICE ' . $d['ice'] : false,
              'comment' => 'Créé depuis shop.dbt.ma' . ($d['societe'] && $d['nom'] ? ', contact : ' . $d['nom'] : '')];
        $pid = (int)odoo('res.partner', 'create', [$v]);
    }
    if (!empty($d['client_id'])) { db()->prepare('UPDATE clients SET odoo_partner_id=? WHERE id=?')->execute([$pid, $d['client_id']]); }
    return $pid;
}

/* Article Odoo : par référence (default_code), sinon par nom exact, sinon création. */
function odoo_article(array $l): int {
    if ($l['sku'] !== '') { $r = odoo('product.product', 'search', [[['default_code', '=', $l['sku']]]], ['limit' => 1]); if ($r) { return (int)$r[0]; } }
    $r = odoo('product.product', 'search', [[['name', '=', $l['nom']]]], ['limit' => 1]); if ($r) { return (int)$r[0]; }
    $v = ['name' => $l['nom'], 'type' => 'consu', 'sale_ok' => true];
    if ($l['sku'] !== '') { $v['default_code'] = $l['sku']; }
    if ($l['prix'] > 0) { $v['list_price'] = odoo_prix($l['prix']); }
    return (int)odoo('product.product', 'create', [$v]);
}
function odoo_prix(float $ttc): float { return setting('odoo_prix_ht', '1') === '1' ? round($ttc / 1.2, 2) : $ttc; }

/* Crée le devis (sale.order) d'une demande et le lien client sécurisé. */
function odoo_devis(int $id): array {
    $st = db()->prepare('SELECT * FROM demandes WHERE id=?'); $st->execute([$id]); $d = $st->fetch();
    if (!$d) { throw new RuntimeException('Demande introuvable.'); }
    if ($d['odoo_id']) { return odoo_maj($id); }
    $pid = odoo_partenaire($d);
    $lignes = [];
    foreach (json_decode($d['lignes'], true) ?: [] as $l) {
        $v = ['product_id' => odoo_article($l), 'product_uom_qty' => (float)$l['qte'], 'name' => $l['nom'] . ($l['sku'] ? ' (réf. ' . $l['sku'] . ')' : '')];
        if ($l['prix'] > 0) { $v['price_unit'] = odoo_prix((float)$l['prix']); }
        $lignes[] = [0, 0, $v];
    }
    $lignes[] = [0, 0, ['display_type' => 'line_note', 'name' => mb_substr("Demande {$d['ref']} reçue sur shop.dbt.ma\n" . $d['contenu'], 0, 3000)]];
    $so = (int)odoo('sale.order', 'create', [['partner_id' => $pid, 'client_order_ref' => $d['ref'], 'origin' => 'shop.dbt.ma ' . $d['ref'], 'order_line' => $lignes]]);
    $tok = bin2hex(random_bytes(16));
    try { odoo('sale.order', 'write', [[$so], ['access_token' => $tok]]); } catch (Throwable $e) { $tok = ''; }
    db()->prepare('UPDATE demandes SET odoo_id=?, odoo_token=? WHERE id=?')->execute([$so, $tok, $id]);
    return odoo_maj($id);
}

/* Relit le devis Odoo : référence, montant, état, factures et règlements. */
function odoo_maj(int $id): array {
    $st = db()->prepare('SELECT id, odoo_id, odoo_token, paiement, total FROM demandes WHERE id=?'); $st->execute([$id]); $d = $st->fetch();
    if (!$d || !$d['odoo_id']) { throw new RuntimeException('Aucun devis Odoo pour cette demande.'); }
    $r = odoo('sale.order', 'read', [[(int)$d['odoo_id']], ['name', 'state', 'amount_total', 'invoice_ids', 'access_token']]);
    if (!$r) { throw new RuntimeException('Le devis a été supprimé dans Odoo.'); }
    $so = $r[0]; $paiement = $d['paiement'];
    if ($so['invoice_ids']) {
        $inv = odoo('account.move', 'read', [$so['invoice_ids'], ['state', 'payment_state']]);
        $post = array_filter($inv, fn($i) => $i['state'] === 'posted');
        if ($post) { $paiement = count(array_filter($post, fn($i) => in_array($i['payment_state'], ['paid', 'in_payment'], true))) === count($post) ? 'paye' : ($paiement === 'paye' ? 'paye' : 'facture'); }
    }
    $tok = $so['access_token'] ?: $d['odoo_token'];
    db()->prepare('UPDATE demandes SET odoo_ref=?, odoo_etat=?, odoo_token=?, total=?, paiement=?, maj_le=? WHERE id=?')
      ->execute([$so['name'], $so['state'], $tok, (float)$so['amount_total'] ?: (float)$d['total'], $paiement, now(), $id]);
    return odoo_liens($id);
}
function odoo_liens(int $id): array {
    $st = db()->prepare('SELECT odoo_id, odoo_ref, odoo_etat, odoo_token, total, paiement FROM demandes WHERE id=?'); $st->execute([$id]); $d = $st->fetch();
    if (!$d || !$d['odoo_id']) { return ['odoo_id' => null]; }
    $b = odoo_base(); $so = (int)$d['odoo_id'];
    $portail = $d['odoo_token'] ? "$b/my/orders/$so?access_token={$d['odoo_token']}" : '';
    return ['odoo_id' => $so, 'odoo_ref' => $d['odoo_ref'], 'odoo_etat' => $d['odoo_etat'], 'total' => (float)$d['total'], 'paiement' => $d['paiement'],
            'lien_odoo' => "$b/web#id=$so&model=sale.order&view_type=form", 'lien_client' => $portail, 'lien_pdf' => $portail ? "$portail&report_type=pdf&download=true" : ''];
}
