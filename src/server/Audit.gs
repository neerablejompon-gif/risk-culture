/**
 * log_Audit — append-only ห้าม update/delete
 */
function writeAudit_(actor, action, entity, entityId, before, after) {
  insertRow_(TABS.AUD, {
    ts: nowIso_(),
    actor_email: actor,
    action: action,
    entity: entity,
    entity_id: entityId,
    before_json: before ? JSON.stringify(stripRow_(before)) : '',
    after_json: after ? JSON.stringify(stripRow_(after)) : ''
  });
}

function stripRow_(o) {
  const c = Object.assign({}, o);
  delete c._row;
  return c;
}
