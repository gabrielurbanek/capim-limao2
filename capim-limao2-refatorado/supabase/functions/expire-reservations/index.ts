import { ApiError, adminClient, endpoint, jsonResponse, requiredEnv, rpc } from '../_shared/http.ts';

function constantTimeMatch(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left); const b = new TextEncoder().encode(right);
  let diff = a.length ^ b.length; const size = Math.max(a.length, b.length);
  for (let i = 0; i < size; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

Deno.serve((request) => endpoint(request, async () => {
  const secret = requiredEnv('RESERVATION_JOB_SECRET');
  const supplied = request.headers.get('x-reservation-job-secret') ?? '';
  if (!supplied || !constantTimeMatch(supplied, secret)) throw new ApiError(401, 'JOB_NOT_AUTHORIZED', 'Agendamento não autorizado.');
  const released = await rpc<number>(adminClient(), 'release_expired_reservations', { p_now: new Date().toISOString() });
  return jsonResponse({ ok: true, expired_reservations_processed: released });
}));
