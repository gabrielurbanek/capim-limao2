import { ApiError, endpoint, jsonResponse, parseBody, requireActor, requireRoles, rpc, isUuid } from '../_shared/http.ts';

Deno.serve((request) => endpoint(request, async () => {
  const { actor, admin } = await requireActor(request);
  requireRoles(actor, ['OWNER', 'MANAGER']);
  const body = await parseBody<Record<string, unknown>>(request);
  if (!isUuid(body.order_id) || !['UNPAID', 'PENDING', 'PAID', 'REFUNDED'].includes(String(body.payment_status))) throw new ApiError(400, 'INVALID_PAYMENT_STATUS', 'Status de pagamento inválido.');
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : null;
  const result = await rpc<Record<string, unknown>>(admin, 'set_order_payment_status', { p_order_id: body.order_id, p_payment_status: body.payment_status, p_actor_id: actor.id, p_note: note });
  return jsonResponse({ order: result });
}));
