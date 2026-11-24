import { ApiError, endpoint, jsonResponse, parseBody, requireActor, requireRoles, rpc, isUuid, decimalValue } from '../_shared/http.ts';

Deno.serve((request) => endpoint(request, async () => {
  const { actor, admin } = await requireActor(request);
  requireRoles(actor, ['OWNER', 'MANAGER']);
  const body = await parseBody<Record<string, unknown>>(request);
  if (!isUuid(body.product_id)) throw new ApiError(400, 'PRODUCT_NOT_FOUND', 'Produto não encontrado.');
  const quantity = decimalValue(body.quantity, 3);
  if (!quantity || Number(quantity) <= 0) throw new ApiError(400, 'QUANTITY_MUST_BE_POSITIVE', 'Informe uma quantidade positiva.');
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (reason.length < 4 || reason.length > 300) throw new ApiError(400, 'INVALID_REASON', 'Informe a origem/justificativa do recebimento.');
  const result = await rpc<Record<string, unknown>>(admin, 'receive_stock', { p_product_id: body.product_id, p_quantity: quantity, p_reason: reason, p_actor_id: actor.id });
  return jsonResponse({ movement: result });
}));
