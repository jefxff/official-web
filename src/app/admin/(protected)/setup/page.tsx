import { buildOtpauthUri, getServerSession, totpEnabled } from "@fmw/auth";
import { redirect } from "next/navigation";
import QRCode from "qrcode";

export const metadata = {
  title: "TOTP 设置 · 富满微后台",
  robots: { index: false, follow: false },
};

export default async function AdminSetupPage() {
  // 页面级鉴权，不能只依赖 (protected)/layout.tsx：
  // 布局与页面是并行渲染的，layout 里的 redirect() 会返回 307，
  // 但页面已渲染的内容仍会被序列化进该 307 响应的 RSC payload ——
  // 这里渲染的是 otpauth://...?secret=XXX，等于把 TOTP 种子公开出去。
  // 所以在读取密钥之前，本页自己再校验一次会话。
  const user = await getServerSession();
  if (!user) redirect("/admin/login");

  const enabled = totpEnabled();
  const uri = buildOtpauthUri();
  let qr = "";
  if (uri) {
    qr = await QRCode.toDataURL(uri, { margin: 1, width: 240 });
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-4">TOTP 二步验证设置</h1>
      {!enabled ? (
        <div className="rounded-[2px] border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-medium">尚未启用 TOTP</p>
          <p className="mt-1">
            请在部署环境注入环境变量 <code>ADMIN_TOTP_SECRET</code>（base32 密钥）。
            设置后管理员登录将强制要求动态码。可在本地用以下命令生成一个：
          </p>
          <pre className="mt-2 bg-[var(--color-surface)] p-2 rounded text-xs overflow-x-auto">
            npx --yes otplib-cli generate-secret
          </pre>
        </div>
      ) : (
        <div className="rounded-[2px] border p-4 bg-[var(--color-surface)]">
          <p className="text-sm text-[var(--color-muted)] mb-3">
            用任意 TOTP App（如 Google Authenticator / 1Password）扫码绑定：
          </p>
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="TOTP QR" className="w-60 h-60" />
          )}
          <p className="mt-3 text-xs text-[var(--color-muted)] break-all">otpauth: {uri}</p>
        </div>
      )}
    </div>
  );
}
