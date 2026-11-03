/**
 * 媒体存储与 SigV4 签名的可验证性测试。
 *
 * 两件事必须被「真的验证」而不是「看起来对」：
 *  1. S3 签名：用 awslabs/aws-c-auth 官方测试向量（get-vanilla）逐项比对
 *     规范请求、待签串、最终签名。签名错一个字节，线上就是 403 SignatureDoesNotMatch。
 *  2. 上传校验：类型按魔数判定、SVG 拒绝、超大文件拒绝、key 不可路径穿越。
 *
 * 运行：npx tsx scripts/test-storage.ts
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  buildCanonicalRequest,
  deriveSigningKey,
  encodePath,
  sha256Hex,
  signRequest,
} from "../src/packages/storage/sigv4";

import {
  detectMediaType,
  rejectionReason,
  buildKey,
  isValidMediaKey,
  saveMedia,
  readMedia,
  MAX_MEDIA_BYTES,
  slugify,
} from "../src/packages/storage";

// 存储根目录在首次使用时惰性读取 env，故此处赋值即可生效。
let mediaRoot = "";

let pass = 0;
let fail = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    console.log(
      `  FAIL  ${name}\n        expected: ${JSON.stringify(expected)}\n        actual:   ${JSON.stringify(actual)}`
    );
  }
}

function checkTrue(name: string, actual: boolean) {
  check(name, actual, true);
}

// —— 官方测试向量（awslabs/aws-c-auth: tests/aws-signing-test-suite/v4/get-vanilla）——
const VECTOR = {
  accessKeyId: "AKIDEXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
  region: "us-east-1",
  service: "service",
  amzDate: "20150830T123600Z",
  host: "example.amazonaws.com",
  expectedCanonicalRequest: [
    "GET",
    "/",
    "",
    "host:example.amazonaws.com",
    "x-amz-date:20150830T123600Z",
    "",
    "host;x-amz-date",
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  ].join("\n"),
  expectedStringToSign: [
    "AWS4-HMAC-SHA256",
    "20150830T123600Z",
    "20150830/us-east-1/service/aws4_request",
    "bb579772317eb040ac9ed261061d46c1f17a8133879d6129b6e1c25292927e63",
  ].join("\n"),
  expectedSignature:
    "5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31",
};

async function main() {
  mediaRoot = await mkdtemp(path.join(tmpdir(), "fmw-media-"));
  process.env.MEDIA_ROOT = mediaRoot;
  process.env.MEDIA_STORAGE = "local";

  console.log("=== SigV4：官方测试向量 get-vanilla ===");
  {
    const headers = {
      host: VECTOR.host,
      "x-amz-date": VECTOR.amzDate,
    };
    const payloadHash = sha256Hex("");

    const { canonicalRequest, signedHeaders } = buildCanonicalRequest({
      method: "GET",
      path: "/",
      query: "",
      headers,
      payloadHash,
    });
    check("规范请求逐字节一致", canonicalRequest, VECTOR.expectedCanonicalRequest);
    check("SignedHeaders 排序正确", signedHeaders, "host;x-amz-date");

    const signed = signRequest({
      method: "GET",
      path: "/",
      query: "",
      headers,
      payloadHash,
      accessKeyId: VECTOR.accessKeyId,
      secretAccessKey: VECTOR.secretAccessKey,
      region: VECTOR.region,
      service: VECTOR.service,
      amzDate: VECTOR.amzDate,
    });
    check("待签串一致", signed.stringToSign, VECTOR.expectedStringToSign);
    check("最终签名一致", signed.signature, VECTOR.expectedSignature);
    check(
      "Authorization 头格式正确",
      signed.authorization,
      `AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, ` +
        `SignedHeaders=host;x-amz-date, Signature=${VECTOR.expectedSignature}`
    );

    // 派生密钥链路单独校验（各段用官方 ASCII 断言值无法反推，这里验证确定性 + 长度）
    const key = deriveSigningKey(VECTOR.secretAccessKey, "20150830", "us-east-1", "service");
    check("派生密钥 32 字节", key.length, 32);
    check(
      "派生密钥确定性",
      deriveSigningKey(VECTOR.secretAccessKey, "20150830", "us-east-1", "service").toString("hex"),
      key.toString("hex")
    );
  }

  console.log("=== 路径编码 ===");
  check("保留分隔符", encodePath("/bucket/media/2026/11/a.png"), "/bucket/media/2026/11/a.png");
  check("编码空格", encodePath("/b/a b.png"), "/b/a%20b.png");
  check("编码括号与感叹号", encodePath("/b/a(b)!.png"), "/b/a%28b%29%21.png");

  console.log("=== 魔数识别 ===");
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(16),
  ]);
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);
  const webp = Buffer.concat([
    Buffer.from("RIFF", "ascii"),
    Buffer.from([0, 0, 0, 0]),
    Buffer.from("WEBP", "ascii"),
    Buffer.alloc(8),
  ]);
  const gif = Buffer.concat([Buffer.from("GIF89a", "ascii"), Buffer.alloc(16)]);
  const pdf = Buffer.concat([Buffer.from("%PDF-1.7", "ascii"), Buffer.alloc(16)]);

  check("PNG", detectMediaType(png)?.ext, "png");
  check("JPEG", detectMediaType(jpeg)?.ext, "jpg");
  check("WebP", detectMediaType(webp)?.ext, "webp");
  check("GIF", detectMediaType(gif)?.ext, "gif");
  check("PDF", detectMediaType(pdf)?.ext, "pdf");
  check("纯文本被拒", detectMediaType(Buffer.from("hello world")), null);
  check(
    "伪造扩展名的文本被拒（不看 Content-Type）",
    detectMediaType(Buffer.from("<?php echo 1; ?>")),
    null
  );
  checkTrue(
    "SVG 被明确拒绝",
    (rejectionReason(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')) ?? "").includes(
      "SVG"
    )
  );
  checkTrue(
    "SVG（带 XML 声明）同样被拒",
    (rejectionReason(Buffer.from('<?xml version="1.0"?><svg/>')) ?? "").includes("SVG")
  );

  console.log("=== key 生成与校验 ===");
  check("slug 仅保留安全字符", slugify("产品 主图 v2!.PNG"), "v2");
  check("slug 空值回落", slugify("图片.png"), "asset");
  const key = buildKey(png, "Product Photo.png", "png");
  checkTrue("生成的 key 合法", isValidMediaKey(key));
  checkTrue("key 含按月分区", /^media\/\d{4}\/\d{2}\//.test(key));
  check("同内容同名生成同 key（重复上传去重）", buildKey(png, "Product Photo.png", "png"), key);
  checkTrue("路径穿越被拒", !isValidMediaKey("media/2026/11/../../etc/passwd"));
  checkTrue("非法扩展名被拒", !isValidMediaKey("media/2026/11/abcdefabcdef-x.svg"));
  check("越权 key 读取返回 null", await readMedia("media/2026/11/../../secret.png"), null);

  console.log("=== 落盘与回读（local provider）===");
  {
    const stored = await saveMedia({ buffer: png, filename: "banner.png" });
    check("返回 MIME", stored.mime, "image/png");
    check("返回 provider", stored.provider, "local");
    checkTrue("URL 指向出流路由", stored.url.includes("/api/v1/media/"));

    const back = await readMedia(stored.key);
    checkTrue("回读内容一致", back?.buffer.equals(png) ?? false);
    check("回读 MIME 正确", back?.mime, "image/png");

    let oversized = "";
    try {
      await saveMedia({ buffer: Buffer.alloc(MAX_MEDIA_BYTES + 1), filename: "big.png" });
    } catch (e) {
      oversized = (e as Error).message;
    }
    checkTrue("超大文件被拒", oversized.includes("上限"));

    let empty = "";
    try {
      await saveMedia({ buffer: Buffer.alloc(0), filename: "empty.png" });
    } catch (e) {
      empty = (e as Error).message;
    }
    checkTrue("空文件被拒", empty.includes("空文件"));

    let svgErr = "";
    try {
      await saveMedia({
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'),
        filename: "x.svg",
      });
    } catch (e) {
      svgErr = (e as Error).message;
    }
    checkTrue("SVG 不可落盘", svgErr.includes("SVG"));
  }

  await rm(mediaRoot, { recursive: true, force: true });

  console.log("");
  console.log(`总计 ${pass + fail} 项：PASS ${pass} / FAIL ${fail}`);
  if (fail > 0) {
    console.error("媒体存储 / 签名实现未通过校验。");
    process.exit(1);
  }
  console.log("媒体存储与 SigV4 签名校验全部通过。");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
