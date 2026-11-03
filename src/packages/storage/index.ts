import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { amzDateOf, encodePath, sha256Hex, signRequest } from "./sigv4";

/**
 * 媒体存储抽象（v1.2 §8 内容运营 + §12 安全基线的落地）。
 *
 * 两种 provider：
 *  - `local`（默认）：落到 MEDIA_ROOT（默认 `.media/`），由 `/api/v1/media/*` 出流。
 *    适用于单节点国内源站 + CDN 回源；多实例部署需把 MEDIA_ROOT 挂到共享存储（NAS/云盘）。
 *  - `s3`：S3 兼容对象存储直传（阿里云 OSS / 腾讯云 COS / MinIO），签名见 ./sigv4.ts，
 *    对外 URL 走 CDN（S3_PUBLIC_BASE），不经过 Node 出流。
 *
 * 安全边界（这里是有意收紧的地方）：
 *  1. **不接收 SVG**：SVG 可内嵌脚本，作为同源资源会绕过 CSP 的 script-src 约束。
 *  2. 类型判定不看 `Content-Type`，只看**魔数**（浏览器上报的 MIME 完全可伪造）。
 *  3. 大小上限在读取 body 之前按 `Content-Length` 预判，避免大包打满内存。
 *  4. 落盘路径由服务端生成（内容哈希 + 白名单扩展名），原始文件名只用于生成可读 slug。
 */

export const MAX_MEDIA_BYTES = 8 * 1024 * 1024; // 8MB
export const EMPTY_PAYLOAD_SHA256 = sha256Hex("");

export type MediaKind = "image" | "document";
export type StorageProvider = "local" | "s3";

export interface MediaType {
  ext: string;
  mime: string;
  kind: MediaKind;
}

export interface StoredMedia {
  key: string;
  url: string;
  size: number;
  mime: string;
  kind: MediaKind;
  provider: StorageProvider;
}

interface Signature {
  ext: string;
  mime: string;
  kind: MediaKind;
  /** 返回命中所需的匹配字节数，0 表示仅前缀足够 */
  match: (b: Buffer) => boolean;
}

const SIGNATURES: Signature[] = [
  {
    ext: "jpg",
    mime: "image/jpeg",
    kind: "image",
    match: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    ext: "png",
    mime: "image/png",
    kind: "image",
    match: (b) =>
      b.length > 8 &&
      b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    ext: "webp",
    mime: "image/webp",
    kind: "image",
    match: (b) =>
      b.length > 12 &&
      b.subarray(0, 4).toString("ascii") === "RIFF" &&
      b.subarray(8, 12).toString("ascii") === "WEBP",
  },
  {
    ext: "gif",
    mime: "image/gif",
    kind: "image",
    match: (b) => b.length > 6 && b.subarray(0, 4).toString("ascii") === "GIF8",
  },
  {
    ext: "pdf",
    mime: "application/pdf",
    kind: "document",
    match: (b) => b.length > 5 && b.subarray(0, 5).toString("ascii") === "%PDF-",
  },
];

/** 明确拒绝的格式（给出可读原因，而不是笼统的「不支持」）。 */
const REJECTED: Array<{ probe: (b: Buffer) => boolean; reason: string }> = [
  {
    probe: (b) => /^\s*(<\?xml|<svg)/i.test(b.subarray(0, 200).toString("utf8")),
    reason: "SVG 可内嵌脚本，作为同源资源会绕过 CSP，禁止上传；请转为 PNG/WebP",
  },
];

/** 按魔数判定真实类型；无法识别返回 null。 */
export function detectMediaType(buffer: Buffer): MediaType | null {
  for (const s of SIGNATURES) {
    if (s.match(buffer)) return { ext: s.ext, mime: s.mime, kind: s.kind };
  }
  return null;
}

export function rejectionReason(buffer: Buffer): string | null {
  for (const r of REJECTED) {
    if (r.probe(buffer)) return r.reason;
  }
  return null;
}

/** 原始文件名 → 可读 slug（仅 a-z0-9-，避免中文/空格进 URL）。 */
export function slugify(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "");
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "asset";
}

/** 服务端生成 key：内容哈希保证同文件天然去重，路径按月分区便于归档。 */
export function buildKey(buffer: Buffer, filename: string, ext: string): string {
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const digest = createHash("sha256").update(buffer).digest("hex").slice(0, 12);
  return `media/${yyyy}/${mm}/${digest}-${slugify(filename)}.${ext}`;
}

/** 出流时的 key 校验：只放行本包生成的形态，杜绝路径穿越与越权扩展名。 */
const KEY_PATTERN =
  /^media\/\d{4}\/\d{2}\/[a-z0-9]{12}-[a-z0-9-]{1,40}\.(jpg|jpeg|png|webp|gif|pdf)$/;

export function isValidMediaKey(key: string): boolean {
  return KEY_PATTERN.test(key) && !key.includes("..");
}

export function mimeOfKey(key: string): string {
  const ext = key.split(".").pop() ?? "";
  const hit = SIGNATURES.find((s) => s.ext === ext);
  return hit?.mime ?? "application/octet-stream";
}

export function activeProvider(): StorageProvider {
  return (process.env.MEDIA_STORAGE ?? "local") === "s3" ? "s3" : "local";
}

export function mediaRoot(): string {
  return process.env.MEDIA_ROOT ?? path.join(process.cwd(), ".media");
}

/** 本地 provider 的对外路径（同源，走 CSP 的 'self' + CDN 缓存）。 */
export function localUrlOf(key: string): string {
  const base = process.env.NEXT_PUBLIC_MEDIA_BASE ?? "";
  return `${base}/api/v1/media/${key}`;
}

interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBase?: string;
}

function s3Config(): S3Config {
  const cfg = {
    endpoint: process.env.S3_ENDPOINT ?? "",
    region: process.env.S3_REGION ?? "us-east-1",
    bucket: process.env.S3_BUCKET ?? "",
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    publicBase: process.env.S3_PUBLIC_BASE,
  };
  const missing = Object.entries({
    S3_ENDPOINT: cfg.endpoint,
    S3_BUCKET: cfg.bucket,
    S3_ACCESS_KEY_ID: cfg.accessKeyId,
    S3_SECRET_ACCESS_KEY: cfg.secretAccessKey,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(`MEDIA_STORAGE=s3 缺少环境变量：${missing.join(", ")}`);
  }
  return cfg;
}

/** 上传到 S3 兼容存储（path-style），返回可直接对外使用的 URL。 */
async function putToS3(cfg: S3Config, key: string, buffer: Buffer, mime: string): Promise<void> {
  const url = new URL(`${cfg.endpoint.replace(/\/$/, "")}/${cfg.bucket}/${key}`);
  const amzDate = amzDateOf(new Date());
  const payloadHash = sha256Hex(buffer);

  const headers: Record<string, string> = {
    host: url.host,
    "content-type": mime,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };

  const signed = signRequest({
    method: "PUT",
    path: encodePath(url.pathname),
    query: "",
    headers,
    payloadHash,
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    region: cfg.region,
    service: "s3",
    amzDate,
  });

  const res = await fetch(url, {
    method: "PUT",
    headers: { ...headers, authorization: signed.authorization },
    body: new Uint8Array(buffer),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`S3 PUT 失败 ${res.status}: ${detail.slice(0, 200)}`);
  }
}

export interface SaveMediaInput {
  buffer: Buffer;
  filename: string;
}

/**
 * 保存媒体文件。类型/大小校验由调用方（上传接口）先行完成，
 * 这里再做一次兜底，保证任何入口都不会写入非白名单文件。
 */
export async function saveMedia({ buffer, filename }: SaveMediaInput): Promise<StoredMedia> {
  if (buffer.byteLength === 0) throw new Error("空文件");
  if (buffer.byteLength > MAX_MEDIA_BYTES) {
    throw new Error(`文件超过 ${Math.round(MAX_MEDIA_BYTES / 1024 / 1024)}MB 上限`);
  }
  const rejected = rejectionReason(buffer);
  if (rejected) throw new Error(rejected);
  const type = detectMediaType(buffer);
  if (!type) throw new Error("不支持的文件类型（仅允许 JPG/PNG/WebP/GIF/PDF）");

  const key = buildKey(buffer, filename, type.ext);
  const provider = activeProvider();

  if (provider === "s3") {
    const cfg = s3Config();
    await putToS3(cfg, key, buffer, type.mime);
    const base = (cfg.publicBase ?? `${cfg.endpoint.replace(/\/$/, "")}/${cfg.bucket}`).replace(
      /\/$/,
      ""
    );
    return {
      key,
      url: `${base}/${key}`,
      size: buffer.byteLength,
      mime: type.mime,
      kind: type.kind,
      provider,
    };
  }

  const target = path.join(mediaRoot(), key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, buffer);
  return {
    key,
    url: localUrlOf(key),
    size: buffer.byteLength,
    mime: type.mime,
    kind: type.kind,
    provider,
  };
}

/** 本地 provider 出流：key 已校验，返回内容与 MIME。 */
export async function readMedia(key: string): Promise<{ buffer: Buffer; mime: string } | null> {
  if (!isValidMediaKey(key)) return null;
  try {
    const buffer = await readFile(path.join(mediaRoot(), key));
    return { buffer, mime: mimeOfKey(key) };
  } catch {
    return null;
  }
}
