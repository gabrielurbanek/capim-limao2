import { ApiError, endpoint, isUuid, jsonResponse, parseBody, requireActor, requireRoles, rpc } from '../_shared/http.ts';

Deno.serve((request) => endpoint(request, async () => {
  const { actor, admin } = await requireActor(request);
  requireRoles(actor, ['OWNER']);
  const body = await parseBody<Record<string, unknown>>(request);
  const action = body.action;

  if (action === 'invite') {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const role = body.role;
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || fullName.length < 2 || fullName.length > 160 || !['MANAGER', 'EMPLOYEE'].includes(String(role))) {
      throw new ApiError(400, 'INVALID_STAFF_INPUT', 'Confira e-mail, nome e cargo.');
    }
    if (phone && (phone.replace(/\D/g, '').length < 8 || phone.replace(/\D/g, '').length > 20)) throw new ApiError(400, 'INVALID_STAFF_INPUT', 'Confira o telefone.');
    const siteUrl = Deno.env.get('SITE_URL')?.replace(/\/$/, '');
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      ...(siteUrl ? { redirectTo: `${siteUrl}/admin/login?invitation=1` } : {}),
    });
    if (inviteError || !invited.user) {
      const message = inviteError?.code === 'email_exists' || inviteError?.status === 422 ? 'Já existe uma conta para esse e-mail. Use a opção de alteração de cargo.' : 'Não foi possível enviar o convite. Revise a configuração de e-mail do Supabase.';
      throw new ApiError(409, 'INVITATION_FAILED', message);
    }
    try {
      await rpc(admin, 'assign_staff_role', { p_actor_id: actor.id, p_user_id: invited.user.id, p_full_name: fullName, p_phone: phone || null, p_role_code: role });
    } catch {
      const { error: deleteError } = await admin.auth.admin.deleteUser(invited.user.id);
      // Se a compensação falhar, a conta continua sem cargo e não pode entrar no painel.
      if (deleteError) console.error('capimlim-edge:staff-invite-compensation-required');
      throw new ApiError(409, 'ROLE_ASSIGNMENT_FAILED', 'O cargo não pôde ser persistido; a conta sem autorização foi invalidada. Revise o painel de Auth antes de reenviar.');
    }
    return jsonResponse({ staff: { id: invited.user.id, email, full_name: fullName, role, is_active: true } }, 201);
  }

  if (!isUuid(body.user_id)) throw new ApiError(400, 'INVALID_STAFF_ID', 'Conta de equipe inválida.');
  if (action === 'set_active' || action === 'deactivate' || action === 'reactivate') {
    const isActive = action === 'deactivate' ? false : action === 'reactivate' ? true : body.is_active;
    if (typeof isActive !== 'boolean') throw new ApiError(400, 'INVALID_STAFF_INPUT', 'Informe o estado de acesso.');
    const result = await rpc<Record<string, unknown>>(admin, 'set_staff_active', { p_actor_id: actor.id, p_user_id: body.user_id, p_active: isActive });
    return jsonResponse({ staff: result, note: 'O backend consulta is_active em cada operação protegida; sessões existentes perdem autorização sem depender de logout do navegador.' });
  }
  if (action === 'set_role' || action === 'change-role') {
    if (!['MANAGER', 'EMPLOYEE'].includes(String(body.role))) throw new ApiError(400, 'INVALID_STAFF_INPUT', 'Cargo inválido.');
    const { data: profile, error: profileError } = await admin.from('profiles').select('full_name,phone').eq('id', body.user_id).maybeSingle();
    if (profileError || !profile) throw new ApiError(404, 'STAFF_NOT_FOUND', 'Conta da equipe não encontrada.');
    const result = await rpc<Record<string, unknown>>(admin, 'assign_staff_role', { p_actor_id: actor.id, p_user_id: body.user_id, p_full_name: profile.full_name ?? '', p_phone: profile.phone, p_role_code: body.role });
    return jsonResponse({ staff: result });
  }
  throw new ApiError(400, 'INVALID_ACTION', 'Operação de equipe inválida.');
}));
