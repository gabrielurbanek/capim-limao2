import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type AppRole = 'OWNER' | 'MANAGER' | 'EMPLOYEE';
export interface Actor { id: string; email: string; fullName: string | null; role: AppRole }
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type, x-bootstrap-secret, x-reservation-job-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};

const userMessages: Record<string, string> = {
  ACTIVE_STAFF_REQUIRED: 'Sua conta não tem acesso ativo ao painel. Consulte a pessoa responsável pela loja.',
  ROLE_NOT_ALLOWED: 'Seu cargo não permite esta operação.',
  MANAGER_REQUIRED: 'Esta operação exige autorização de MANAGER ou OWNER.',
  OWNER_REQUIRED: 'Esta operação é exclusiva de OWNER.',
  OWNER_ONLY_NEGATIVE_STOCK: 'Somente OWNER pode autorizar saldo negativo.',
  DISCOUNT_REQUIRES_MANAGER: 'Descontos exigem autorização de MANAGER ou OWNER.',
  INSUFFICIENT_STOCK: 'Estoque insuficiente para essa quantidade.',
  PRODUCT_UNAVAILABLE: 'Um produto não está mais disponível.',
  PRODUCT_NOT_FOUND: 'Produto não encontrado.',
  INVALID_QUANTITY: 'A quantidade informada não respeita a unidade do produto.',
  QUANTITY_MUST_BE_INTEGER: 'Unidades e gramas devem ser quantidades inteiras.',
  QUANTITY_PRECISION_EXCEEDED: 'Quilogramas aceitam até três casas decimais.',
  ORDER_RESERVATION_EXPIRED: 'A reserva do pedido expirou. Confira o estoque antes de confirmar.',
  INVALID_OR_UNAUTHORIZED_TRANSITION: 'Essa mudança de status não é permitida para o cargo ou estado atual.',
  ORDER_NOT_FOUND: 'Pedido não encontrado.',
  SALE_NOT_FOUND: 'Venda não encontrada.',
  INVALID_ITEMS: 'A venda ou pedido precisa conter itens válidos.',
  INVALID_CUSTOMER: 'Informe nome e telefone válidos para o pedido.',
  INVALID_CUSTOMER_PHONE: 'Telefone do cliente inválido.',
  INVALID_EMAIL: 'E-mail inválido.',
  INVALID_PAYMENT_METHOD: 'Selecione uma forma de pagamento válida.',
  INVALID_DISCOUNT: 'O valor do desconto é inválido.',
  DISCOUNT_EXCEEDS_SUBTOTAL: 'O desconto não pode superar o subtotal.',
  CANCELLATION_REASON_REQUIRED: 'Informe uma justificativa para cancelar.',
  CANCELLED_ORDER_CANNOT_BE_PAID: 'Um pedido cancelado não pode ser marcado como pago.',
  REFUND_IS_FINAL: 'Um pagamento estornado não pode ser reaberto.',
  INVALID_ORDER_STATUS: 'Status de pedido inválido.',
  INVALID_PAYMENT_STATUS: 'Status de pagamento inválido.',
  INVALID_IDEMPOTENCY_KEY: 'Não foi possível identificar esta tentativa de pedido.',
  QUANTITY_MUST_BE_POSITIVE: 'Informe uma quantidade positiva.',
  ADJUSTMENT_CANNOT_BE_ZERO: 'Ajuste de estoque não pode ser zero.',
  IMMUTABLE_LEDGER_ROW: 'O histórico é imutável e não pode ser editado.',
};

export function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders } });
}
export function optionsResponse(request: Request): Response | null {
  if (request.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } }, 405, { Allow: 'POST, OPTIONS' });
  return null;
}
export function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new ApiError(503, 'SERVICE_NOT_CONFIGURED', 'O serviço ainda não foi configurado.');
  return value;
}
export function adminClient(): SupabaseClient {
  return createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
export async function parseBody<T extends Record<string, unknown>>(request: Request): Promise<T> {
  let body: unknown;
  try { body = await request.json(); } catch { throw new ApiError(400, 'INVALID_JSON', 'O corpo da solicitação não é um JSON válido.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'INVALID_BODY', 'Dados da solicitação inválidos.');
  return body as T;
}
export const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const decimalValue = (value: unknown, maxScale = 3): string | null => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).replace(',', '.');
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${maxScale}})?$`).test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? text : null;
};
export function errorResponse(reason: unknown): Response {
  if (reason instanceof ApiError) return jsonResponse({ error: { code: reason.code, message: reason.message } }, reason.status);
  if (reason && typeof reason === 'object' && 'code' in reason && 'message' in reason) {
    const dbError = reason as { code?: string; message?: string };
    const sqlMessage = (dbError.message ?? '').split('\n')[0].trim();
    const known = userMessages[sqlMessage];
    const status = dbError.code === '42501' ? 403 : dbError.code === 'P0002' ? 404 : dbError.code === '55P03' ? 409 : dbError.code === '23505' ? 409 : dbError.code === '22023' ? 400 : 409;
    return jsonResponse({ error: { code: dbError.code ?? 'OPERATION_REJECTED', message: known ?? 'O backend recusou a operação. Revise os dados e as permissões.' } }, status);
  }
  return jsonResponse({ error: { code: 'INTERNAL_ERROR', message: 'Não foi possível concluir a operação agora.' } }, 500);
}
export async function requireActor(request: Request): Promise<{ actor: Actor; admin: SupabaseClient }> {
  const authorization = request.headers.get('authorization');
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new ApiError(401, 'AUTH_REQUIRED', 'Entre na sua conta para continuar.');
  const url = requiredEnv('SUPABASE_URL');
  const anon = requiredEnv('SUPABASE_ANON_KEY');
  const verifier = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${match[1]}` } },
  });
  const { data: userResult, error: userError } = await verifier.auth.getUser(match[1]);
  if (userError || !userResult.user) throw new ApiError(401, 'AUTH_INVALID', 'Sua sessão expirou. Entre novamente.');
  const admin = adminClient();
  const [{ data: profile, error: profileError }, { data: roleRecord, error: roleError }] = await Promise.all([
    admin.from('profiles').select('id,full_name,is_active,email').eq('id', userResult.user.id).maybeSingle(),
    admin.from('user_roles').select('role_code').eq('user_id', userResult.user.id).maybeSingle(),
  ]);
  if (profileError || roleError) throw new ApiError(503, 'AUTH_LOOKUP_FAILED', 'Não foi possível verificar o acesso.');
  if (!profile || !profile.is_active || !roleRecord || !['OWNER', 'MANAGER', 'EMPLOYEE'].includes(roleRecord.role_code)) {
    throw new ApiError(403, 'ACTIVE_STAFF_REQUIRED', userMessages.ACTIVE_STAFF_REQUIRED);
  }
  return { actor: { id: userResult.user.id, email: profile.email ?? userResult.user.email ?? '', fullName: profile.full_name, role: roleRecord.role_code as AppRole }, admin };
}
export function requireRoles(actor: Actor, roles: AppRole[]): void {
  if (!roles.includes(actor.role)) throw new ApiError(403, 'ROLE_NOT_ALLOWED', userMessages.ROLE_NOT_ALLOWED);
}
export async function rpc<T = unknown>(admin: SupabaseClient, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(name, args);
  if (error) throw error;
  return data as T;
}
export async function endpoint(request: Request, action: () => Promise<Response>): Promise<Response> {
  const preflight = optionsResponse(request);
  if (preflight) return preflight;
  try { return await action(); }
  catch (reason) {
    // Só código é registrado; nunca token, senha, telefone, e-mail ou texto do cliente.
    if (reason instanceof ApiError) return errorResponse(reason);
    if (reason && typeof reason === 'object' && 'code' in reason) return errorResponse(reason);
    console.error('capimlim-edge:unexpected');
    return errorResponse(reason);
  }
}
export function cleanPhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 20 ? digits : null;
}
export function validateItems(value: unknown, maxItems = 100): Array<{ product_id: string; quantity: string }> {
  if (!Array.isArray(value) || value.length < 1 || value.length > maxItems) throw new ApiError(400, 'INVALID_ITEMS', userMessages.INVALID_ITEMS);
  return value.map((entry) => {
    if (!entry || typeof entry !== 'object') throw new ApiError(400, 'INVALID_ITEMS', userMessages.INVALID_ITEMS);
    const row = entry as Record<string, unknown>;
    const quantity = decimalValue(row.quantity, 3);
    if (!isUuid(row.product_id) || !quantity || Number(quantity) <= 0) throw new ApiError(400, 'INVALID_ITEMS', userMessages.INVALID_ITEMS);
    return { product_id: row.product_id, quantity };
  });
}
