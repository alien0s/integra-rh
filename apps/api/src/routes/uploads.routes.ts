import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { rodaComoUsuario } from '../lib/database.js';
import { getUsuarioAvatarKey, removerAvatarUsuario, updateUserAvatar } from '../lib/usuarios.js';
import { deleteObject, uploadObject } from '../lib/storage.js';

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Só o dono da foto ou ADMIN — sem isso, qualquer autenticado (mesmo
 * COLABORADOR) podia trocar/apagar o avatar de QUALQUER outro usuário só
 * mudando o :usuarioId na URL (IDOR).
 */
async function exigirProprioOuAdmin(
  request: FastifyRequest<{ Params: { usuarioId: string } }>,
  reply: FastifyReply,
) {
  const { papelCodigo, id } = request.user;
  if (papelCodigo === undefined || papelCodigo === 'ADMIN') return; // dev / admin passam
  if (request.params.usuarioId !== id) {
    await reply.code(403).send({ message: 'Você só pode alterar a própria foto.' });
  }
}

/**
 * Rotas de upload de arquivos para o object storage (MinIO/S3).
 */
export async function uploadsRoutes(app: FastifyInstance) {
  app.post<{ Params: { usuarioId: string } }>(
    '/usuarios/:usuarioId/avatar',
    {
      onRequest: [app.authenticate, exigirProprioOuAdmin],
      schema: {
        tags: ['Usuários'],
        summary: 'Envia (ou troca) a foto do usuário',
        consumes: ['multipart/form-data'],
      },
    },
    async (request, reply) => {
      const file = await request.file();

      if (!file) {
        return reply.code(400).send({ message: 'Nenhum arquivo enviado' });
      }

      if (!TIPOS_PERMITIDOS.includes(file.mimetype)) {
        return reply
          .code(415)
          .send({ message: 'Formato inválido. Use JPEG, PNG ou WebP.' });
      }

      const buffer = await file.toBuffer();
      const extensao = extname(file.filename) || '.jpg';
      const key = `avatars/${request.params.usuarioId}/${randomUUID()}${extensao}`;

      await uploadObject(key, buffer, file.mimetype);

      return rodaComoUsuario(request.user, async () => {
        const usuario = await updateUserAvatar(request.params.usuarioId, key);

        if (!usuario) {
          return reply.code(404).send({ message: 'Usuário não encontrado' });
        }

        // Caminho servido pela própria API (o front prefixa com "/api").
        const url = `/usuarios/${request.params.usuarioId}/avatar`;

        return { key, url, usuario };
      });
    },
  );

  app.delete<{ Params: { usuarioId: string } }>(
    '/usuarios/:usuarioId/avatar',
    {
      onRequest: [app.authenticate, exigirProprioOuAdmin],
      schema: { tags: ['Usuários'], summary: 'Remove a foto do usuário' },
    },
    async (request, reply) => {
      const { usuarioId } = request.params;

      return rodaComoUsuario(request.user, async () => {
        // Só existe chave no storage quando o avatar foi enviado por upload
        // (não quando veio como data URI do AD/Microsoft ou URL http).
        const key = await getUsuarioAvatarKey(usuarioId);
        if (key) {
          try {
            await deleteObject(key);
          } catch (error) {
            request.log.warn({ error, key }, 'Falha ao remover avatar do storage');
          }
        }

        const usuario = await removerAvatarUsuario(usuarioId);

        if (!usuario) {
          return reply.code(404).send({ message: 'Usuário não encontrado' });
        }

        return { data: usuario };
      });
    },
  );
}
