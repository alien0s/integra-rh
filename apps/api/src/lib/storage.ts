import type { Readable } from 'node:stream';

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { getApiConfig } from '../plugins/env.js';

let _client: S3Client | null = null;

function getClient() {
  if (!_client) {
    const { storage } = getApiConfig();
    _client = new S3Client({
      endpoint: storage.endpoint,
      region: storage.region,
      forcePathStyle: storage.forcePathStyle, // obrigatório no MinIO
      credentials: {
        accessKeyId: storage.accessKey,
        secretAccessKey: storage.secretKey,
      },
    });
  }
  return _client;
}

/**
 * Garante que o bucket existe (cria se necessário). Chamado no boot da API.
 */
export async function ensureBucket() {
  const client = getClient();
  const { bucket } = getApiConfig().storage;

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}

/**
 * Envia um objeto para o bucket e retorna a chave (key) usada.
 * Garante o bucket antes (idempotente) — cobre o caso da API ter subido
 * antes do MinIO, quando o ensureBucket do boot falhou.
 */
export async function uploadObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const client = getClient();
  const { bucket } = getApiConfig().storage;

  await ensureBucket();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  return key;
}

/**
 * Baixa um objeto como stream, para ser repassado pela API ao navegador.
 * Assim o browser nunca acessa o MinIO diretamente (nem precisa da porta 9000).
 */
export async function getObjectStream(
  key: string,
): Promise<{ body: Readable; contentType: string }> {
  const client = getClient();
  const { bucket } = getApiConfig().storage;

  const res = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );

  return {
    body: res.Body as Readable,
    contentType: res.ContentType ?? 'application/octet-stream',
  };
}

/**
 * Gera uma URL temporária assinada para leitura de um objeto privado.
 */
export async function getPresignedUrl(key: string, expiresInSeconds = 3600) {
  const client = getClient();
  const { bucket } = getApiConfig().storage;

  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: expiresInSeconds },
  );
}

/**
 * Remove um objeto do bucket.
 */
export async function deleteObject(key: string) {
  const client = getClient();
  const { bucket } = getApiConfig().storage;

  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
