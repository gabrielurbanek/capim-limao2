import { ApiError, endpoint, errorResponse, isUuid, jsonResponse, parseBody, requireActor, rpc } from '../_shared/http.ts';

Deno.serve((request) => endpoint(request, async () => {
  const { actor, admin } = await requireActor(request);
  const body = await parseBody<Record<string, unknown>>(request);
  if (!isUuid(body.order_id)) throw new ApiError(400, 'INVALID_ORDER_ID', 'Pedido inválido.');
  if (typeof body.status !== 'string') throw new ApiError(400, 'INVALID_ORDER_STATUS', 'Status de pedido inválido.');
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : null;
  const result = await rpc<Record<string, unknown>>(admin, 'update_order_status', { p_order_id: body.order_id, p_status: body.status, p_actor_id: actor.id, p_note: note });
  return jsonResponse({ order: result });
}));
