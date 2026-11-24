import { ApiError, endpoint, jsonResponse, parseBody, requireActor, requireRoles, rpc, isUuid } from '../_shared/http.ts';

Deno.serve((request) => endpoint(request, async () => {
  const { actor, admin } = await requireActor(request);
  requireRoles(actor, ['OWNER', 'MANAGER']);
  const body = await parseBody<Record<string, unknown>>(request);
  if (!isUuid(body.sale_id)) throw new ApiError(400, 'SALE_NOT_FOUND', 'Venda não encontrada.');
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (reason.length < 4 || reason.length > 300) throw new ApiError(400, 'CANCELLATION_REASON_REQUIRED', 'Informe uma justificativa para cancelar.');
  const result = await rpc<Record<string, unknown>>(admin, 'cancel_sale', { p_sale_id: body.sale_id, p_actor_id: actor.id, p_reason: reason });
  return jsonResponse({ sale: result });
}));
