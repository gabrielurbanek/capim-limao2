import { ApiError, endpoint, jsonResponse, parseBody, requireActor, rpc, isUuid } from '../_shared/http.ts';

Deno.serve((request) => endpoint(request, async () => {
  const { actor, admin } = await requireActor(request);
  if (!['OWNER', 'MANAGER'].includes(actor.role)) throw new ApiError(403, 'ROLE_NOT_ALLOWED', 'Seu cargo não permite esta operação.');
  const body = await parseBody<Record<string, unknown>>(request);
  if (!isUuid(body.product_id)) throw new ApiError(400, 'PRODUCT_NOT_FOUND', 'Produto não encontrado.');
  const delta = typeof body.quantity_delta === 'string' || typeof body.quantity_delta === 'number' ? String(body.quantity_delta).replace(',', '.') : '';
  if (!/^-?\d+(?:\.\d{1,3})?$/.test(delta) || !Number.isFinite(Number(delta)) || Number(delta) === 0) throw new ApiError(400, 'INVALID_QUANTITY', 'A variação deve ser diferente de zero e ter até três casas decimais.');
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (reason.length < 4 || reason.length > 300) throw new ApiError(400, 'INVALID_REASON', 'Informe uma justificativa entre 4 e 300 caracteres.');
  const allowNegative = body.allow_negative === true;
  if (allowNegative && actor.role !== 'OWNER') throw new ApiError(403, 'OWNER_ONLY_NEGATIVE_STOCK', 'Somente OWNER pode autorizar saldo negativo.');
  const result = await rpc<Record<string, unknown>>(admin, 'adjust_stock', { p_product_id: body.product_id, p_quantity_delta: delta, p_reason: reason, p_actor_id: actor.id, p_allow_negative: allowNegative });
  return jsonResponse({ adjustment: result });
}));
