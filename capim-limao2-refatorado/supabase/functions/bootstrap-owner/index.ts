import { ApiError, adminClient, endpoint, jsonResponse, parseBody, requiredEnv, rpc } from '../_shared/http.ts';

function constantTimeMatch(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left); const b = new TextEncoder().encode(right);
  let diff = a.length ^ b.length;
  const size = Math.max(a.length, b.length);
  for (let i = 0; i < size; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

Deno.serve((request) => endpoint(request, async () => {
  const secret = requiredEnv('OWNER_BOOTSTRAP_SECRET');
  const supplied = request.headers.get('x-bootstrap-secret') ?? '';
  if (!supplied || !constantTimeMatch(supplied, secret)) throw new ApiError(401, 'BOOTSTRAP_NOT_AUTHORIZED', 'Inicialização não autorizada.');
  const body = await parseBody<Record<string, unknown>>(request);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 12 || password.length > 128 || fullName.length < 2 || fullName.length > 160) {
    throw new ApiError(400, 'INVALID_BOOTSTRAP_INPUT', 'Informe nome, e-mail válido e senha de pelo menos 12 caracteres.');
  }
  const admin = adminClient();
  const attemptId = crypto.randomUUID();
  await rpc(admin, 'bootstrap_begin', { p_attempt_id: attemptId });

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createError || !created.user) {
    await rpc(admin, 'bootstrap_fail', { p_attempt_id: attemptId, p_failure_code: 'AUTH_USER_CREATION_FAILED', p_orphan_user_id: null });
    throw new ApiError(409, 'BOOTSTRAP_AUTH_FAILED', 'A conta inicial não foi criada. Confira a configuração de Auth e tente novamente.');
  }

  try {
    await rpc(admin, 'bootstrap_complete', { p_attempt_id: attemptId, p_user_id: created.user.id, p_full_name: fullName });
    return jsonResponse({ completed: true, message: 'Conta OWNER inicial criada. Guarde suas credenciais em local seguro e remova OWNER_BOOTSTRAP_SECRET do ambiente.' }, 201);
  } catch {
    // RPC pode confirmar no banco e perder a resposta de rede: nunca remover um OWNER já persistido.
    const { data: state, error: stateError } = await admin.from('system_bootstrap').select('state,owner_user_id').eq('id', 'initial-owner').maybeSingle();
    if (!stateError && state?.state === 'COMPLETED' && state.owner_user_id === created.user.id) {
      return jsonResponse({ completed: true, message: 'Conta OWNER inicial criada.' }, 200);
    }
    if (stateError) {
      // Incerteza: preserve a conta e bloqueie nova execução até reconciliação manual.
      await rpc(admin, 'bootstrap_fail', { p_attempt_id: attemptId, p_failure_code: 'COMPLETION_STATE_UNAVAILABLE', p_orphan_user_id: created.user.id });
      throw new ApiError(503, 'BOOTSTRAP_RECONCILIATION_REQUIRED', 'A criação precisa de reconciliação. Não repita o bootstrap até verificar Auth e o estado inicial.');
    }
    const { error: deleteError } = await admin.auth.admin.deleteUser(created.user.id);
    if (deleteError) {
      await rpc(admin, 'bootstrap_fail', { p_attempt_id: attemptId, p_failure_code: 'COMPENSATION_DELETE_FAILED', p_orphan_user_id: created.user.id });
      throw new ApiError(503, 'BOOTSTRAP_RECONCILIATION_REQUIRED', 'A conta sem vínculo não pôde ser removida automaticamente. O bootstrap está bloqueado para reconciliação segura.');
    }
    await rpc(admin, 'bootstrap_fail', { p_attempt_id: attemptId, p_failure_code: 'COMPLETION_FAILED_COMPENSATING', p_orphan_user_id: created.user.id });
    await rpc(admin, 'bootstrap_compensated', { p_attempt_id: attemptId, p_user_id: created.user.id });
    throw new ApiError(503, 'BOOTSTRAP_COMPENSATED', 'A criação incompleta foi desfeita. Revise o serviço e tente de novo.');
  }
}));
