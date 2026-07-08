import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';

import type { FastifyInstance } from 'fastify';

import { updateUserAvatar } from '../lib/database.js';
import { uploadObject } from '../lib/storage.js';

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Rotas de upload de arquivos para o object storage (MinIO/S3).
 */
export async function uploadsRoutes(app: FastifyInstance) {
  app.post<{ Params: { usuarioId: string } }>(
    '/usuarios/:usuarioId/avatar',
    { onRequest: [app.authenticate] },
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

      const usuario = await updateUserAvatar(request.params.usuarioId, key);

      if (!usuario) {
        return reply.code(404).send({ message: 'Usuário não encontrado' });
      }

      // Caminho servido pela própria API (o front prefixa com "/api").
      const url = `/usuarios/${request.params.usuarioId}/avatar`;

      return { key, url, usuario };
    },
  );
}
