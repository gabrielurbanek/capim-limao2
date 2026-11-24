import { ApiError, endpoint, errorResponse, isUuid, jsonResponse, parseBody, requiredEnv, adminClient, rpc, validateItems } from '../_shared/http.ts';

Deno.serve((request) => endpoint(request, async () => {
  if (request.method !== 'POST') return errorResponse(new ApiError(405, 'METHOD_NOT_ALLOWED', 'Método não permitido.'));
  requiredEnv('SUPABASE_URL'); requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const body = await parseBody<Record<string, unknown>>(request);
  const items = validateItems(body.items, 50);
  if (!isUuid(body.idempotency_key)) throw new ApiError(400, 'INVALID_IDEMPOTENCY_KEY', 'Não foi possível identificar esta tentativa de pedido.');
  if (!body.customer || typeof body.customer !== 'object' || Array.isArray(body.customer)) throw new ApiError(400, 'INVALID_CUSTOMER', 'Informe nome e telefone válidos para o pedido.');
  const customer = body.customer as Record<string, unknown>;
  const name = typeof customer.name === 'string' ? customer.name.trim() : '';
  const phone = typeof customer.phone === 'string' ? customer.phone.trim() : '';
  const email = typeof customer.email === 'string' && customer.email.trim() ? customer.email.trim() : null;
  if (name.length < 2 || name.length > 160 || phone.replace(/\D/g, '').length < 8 || phone.replace(/\D/g, '').length > 20) {
    throw new ApiError(400, 'INVALID_CUSTOMER', 'Informe nome e telefone válidos para o pedido.');
  }
  const result = await rpc<Record<string, unknown>>(adminClient(), 'create_order', {
    p_items: items,
    p_customer: { name, phone, email },
    p_idempotency_key: body.idempotency_key,
  });
  return jsonResponse({ order: result }, 201);
}));
