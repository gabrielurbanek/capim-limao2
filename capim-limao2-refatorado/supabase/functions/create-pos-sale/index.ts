import { ApiError, endpoint, jsonResponse, parseBody, requireActor, requireRoles, rpc, validateItems } from '../_shared/http.ts';

Deno.serve((request) => endpoint(request, async () => {
  const { actor, admin } = await requireActor(request);
  requireRoles(actor, ['OWNER', 'MANAGER', 'EMPLOYEE']);
  const body = await parseBody<Record<string, unknown>>(request);
  const items = validateItems(body.items);
  const discountText = typeof body.discount === 'string' || typeof body.discount === 'number' ? String(body.discount).replace(',', '.') : '0';
  if (!/^\d+(?:\.\d{1,2})?$/.test(discountText) || !Number.isFinite(Number(discountText))) throw new ApiError(400, 'INVALID_DISCOUNT', 'O valor do desconto é inválido.');
  const method = body.payment_method;
  if (!['cash', 'pix', 'debit_card', 'credit_card', 'other'].includes(String(method))) throw new ApiError(400, 'INVALID_PAYMENT_METHOD', 'Selecione uma forma de pagamento válida.');
  const phone = body.customer_phone === null || body.customer_phone === '' ? null : typeof body.customer_phone === 'string' ? body.customer_phone.trim() : null;
  if (body.customer_phone && !phone) throw new ApiError(400, 'INVALID_CUSTOMER_PHONE', 'Telefone do cliente inválido.');
  const sale = await rpc<Record<string, unknown>>(admin, 'create_pos_sale', {
    p_actor_id: actor.id, p_items: items, p_discount: discountText, p_payment_method: method, p_customer_phone: phone,
  });
  return jsonResponse({ sale });
}));
