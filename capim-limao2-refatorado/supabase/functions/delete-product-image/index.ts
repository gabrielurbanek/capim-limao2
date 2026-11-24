import { ApiError, endpoint, isUuid, jsonResponse, parseBody, requireActor, requireRoles, rpc } from '../_shared/http.ts';

Deno.serve((request) => endpoint(request, async () => {
  const { actor, admin } = await requireActor(request);
  requireRoles(actor, ['OWNER', 'MANAGER']);
  const body = await parseBody<Record<string, unknown>>(request);
  if (!isUuid(body.image_id)) throw new ApiError(400, 'INVALID_IMAGE_ID', 'Imagem inválida.');
  const { data: image, error: queryError } = await admin.from('product_images').select('path').eq('id', body.image_id).maybeSingle();
  if (queryError) throw new ApiError(503, 'IMAGE_LOOKUP_FAILED', 'Não foi possível verificar a imagem.');
  if (!image) return jsonResponse({ deleted: true, already_removed: true });
  const [folder, fileName] = image.path.split('/');
  if (!folder || !fileName) throw new ApiError(409, 'INVALID_IMAGE_PATH', 'O caminho da imagem não está no formato esperado.');

  // Saga idempotente: se o objeto já foi removido numa tentativa anterior, conclui a limpeza do registro SQL.
  const { data: files, error: listError } = await admin.storage.from('product-images').list(folder, { search: fileName, limit: 100 });
  if (listError) throw new ApiError(503, 'STORAGE_LOOKUP_FAILED', 'Não foi possível verificar o objeto no Storage.');
  if ((files ?? []).some((file) => file.name === fileName)) {
    const { error: removeError } = await admin.storage.from('product-images').remove([image.path]);
    if (removeError) throw new ApiError(503, 'STORAGE_DELETE_FAILED', 'O objeto não foi removido do Storage; o registro do catálogo permanece intacto.');
  }
  await rpc(admin, 'delete_product_image', { p_image_id: body.image_id, p_actor_id: actor.id });
  return jsonResponse({ deleted: true });
}));
