import { createHash, createHmac } from "node:crypto";

/**
 * AWS Signature V4（精简实现，仅覆盖「带 Authorization 头的单次请求」场景）。
 *
 * 为什么不装 SDK：本项目对依赖体积与攻击面敏感（见 docs/security-policy.md 的分级门禁），
 * 而对象存储上传只需要一个 PUT。算法本身是公开稳定的规范，实现后可用官方测试向量校验
 * （见 scripts/test-storage.ts，采用 awslabs/aws-c-auth 的 get-vanilla 用例）。
 *
 * 兼容性：阿里云 OSS / 腾讯云 COS / MinIO 均支持 S3 兼容的 V4 签名（细节差异见各厂商文档）。
 */

export interface SignInput {
  method: string;
  /** 已编码的路径（含 bucket，path-style） */
  path: string;
  /** 已编码的查询串（不含 `?`），无则空串 */
  query?: string;
  /** 参与签名的请求头，键大小写不敏感，值为已 trim 的原文 */
  headers: Record<string, string>;
  /** 请求体 SHA256（空体为 e3b0c442...） */
  payloadHash: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string;
  /** ISO8601 basic 格式：20150830T123600Z */
  amzDate: string;
}

export interface SignedRequest {
  authorization: string;
  signature: string;
  canonicalRequest: string;
  stringToSign: string;
  signedHeaders: string;
}

export function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

/**
 * RFC3986 编码：encodeURIComponent 会漏掉 `!'()*`，而 SigV4 要求除
 * `A-Za-z0-9-_.~` 外全部百分号编码，故这里显式补齐。
 */
export function uriEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/** 按段编码路径，保留 `/` 分隔符（S3 要求单次编码，不能编码两次）。 */
export function encodePath(path: string): string {
  return path
    .split("/")
    .map((seg) => uriEncode(seg))
    .join("/");
}

export function deriveSigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string
): Buffer {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

export function buildCanonicalRequest(input: {
  method: string;
  path: string;
  query?: string;
  headers: Record<string, string>;
  payloadHash: string;
}): { canonicalRequest: string; signedHeaders: string } {
  const normalized = Object.entries(input.headers)
    .map(([k, v]) => [k.toLowerCase().trim(), v.trim().replace(/\s+/g, " ")] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  const canonicalHeaders = normalized.map(([k, v]) => `${k}:${v}\n`).join("");
  const signedHeaders = normalized.map(([k]) => k).join(";");

  const canonicalRequest = [
    input.method.toUpperCase(),
    input.path || "/",
    input.query ?? "",
    canonicalHeaders,
    signedHeaders,
    input.payloadHash,
  ].join("\n");

  return { canonicalRequest, signedHeaders };
}

export function signRequest(input: SignInput): SignedRequest {
  const { canonicalRequest, signedHeaders } = buildCanonicalRequest(input);

  const dateStamp = input.amzDate.slice(0, 8);
  const scope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    input.amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = deriveSigningKey(
    input.secretAccessKey,
    dateStamp,
    input.region,
    input.service
  );
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign, "utf8")
    .digest("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { authorization, signature, canonicalRequest, stringToSign, signedHeaders };
}

/** 生成 20150830T123600Z 形式的签名时间戳。 */
export function amzDateOf(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}
