import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export type StorageConfig = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
};

/** يقرأ أسماء Railway الافتراضية أو S3_* */
export function getStorageConfig(): StorageConfig | null {
  const endpoint =
    process.env.S3_ENDPOINT ?? process.env.BUCKET_ENDPOINT ?? process.env.ENDPOINT;
  const bucket = process.env.S3_BUCKET ?? process.env.BUCKET;
  const accessKeyId =
    process.env.S3_ACCESS_KEY_ID ??
    process.env.BUCKET_ACCESS_KEY_ID ??
    process.env.ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.S3_SECRET_ACCESS_KEY ??
    process.env.BUCKET_SECRET_ACCESS_KEY ??
    process.env.SECRET_ACCESS_KEY;
  const region =
    process.env.S3_REGION ?? process.env.BUCKET_REGION ?? process.env.REGION ?? "auto";

  if (!endpoint?.trim() || !bucket?.trim() || !accessKeyId?.trim() || !secretAccessKey?.trim()) {
    return null;
  }
  return {
    endpoint: endpoint.trim(),
    bucket: bucket.trim(),
    accessKeyId: accessKeyId.trim(),
    secretAccessKey: secretAccessKey.trim(),
    region: region.trim() || "auto",
  };
}

/** أسماء المتغيرات الناقصة — للمساعدة في التشخيص دون طباعة القيم */
export function missingStorageEnvNames(): string[] {
  const pairs: [string, string | undefined][] = [
    ["S3_ENDPOINT|ENDPOINT", process.env.S3_ENDPOINT ?? process.env.BUCKET_ENDPOINT ?? process.env.ENDPOINT],
    ["S3_BUCKET|BUCKET", process.env.S3_BUCKET ?? process.env.BUCKET],
    [
      "S3_ACCESS_KEY_ID|ACCESS_KEY_ID",
      process.env.S3_ACCESS_KEY_ID ?? process.env.BUCKET_ACCESS_KEY_ID ?? process.env.ACCESS_KEY_ID,
    ],
    [
      "S3_SECRET_ACCESS_KEY|SECRET_ACCESS_KEY",
      process.env.S3_SECRET_ACCESS_KEY ??
        process.env.BUCKET_SECRET_ACCESS_KEY ??
        process.env.SECRET_ACCESS_KEY,
    ],
  ];
  return pairs.filter(([, v]) => !v?.trim()).map(([name]) => name);
}

export function isStorageConfigured(): boolean {
  return getStorageConfig() !== null;
}

let _client: S3Client | null = null;

function getClient(): { client: S3Client; bucket: string } {
  const cfg = getStorageConfig();
  if (!cfg) throw new Error("تخزين S3 غير مضبوط — عيّن S3_* أو متغيرات Railway Bucket");
  if (!_client) {
    _client = new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
      // Railway/R2: virtual-hosted (لا تستخدم forcePathStyle)
    });
  }
  return { client: _client, bucket: cfg.bucket };
}

/** المسار العام عبر بروكسي التطبيق — البكت خاص */
export function mediaUrl(key: string): string {
  return `/media/${key.replace(/^\/+/, "")}`;
}

export async function uploadObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  const { client, bucket } = getClient();
  const normalized = key.replace(/^\/+/, "");
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: normalized,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return mediaUrl(normalized);
}

export async function getObject(key: string) {
  const { client, bucket } = getClient();
  return client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key.replace(/^\/+/, ""),
    }),
  );
}
