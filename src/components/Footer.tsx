import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

export default function Footer() {
  const t = useTranslations("footer");
  const tn = useTranslations("nav");
  const ts = useTranslations("site");

  return (
    <footer className="mt-16 bg-[var(--color-brand-dark)] text-white/80">
      <div className="container-page grid gap-8 py-12 md:grid-cols-3">
        <div>
          <div className="text-white font-bold text-lg mb-2">{ts("name")}</div>
          <p className="text-sm text-white/60 max-w-xs">{ts("description")}</p>
        </div>

        <div>
          <div className="font-medium text-white mb-3">{t("links")}</div>
          <ul className="space-y-2 text-sm">
            <li><Link href="/products" className="hover:text-white">{tn("products")}</Link></li>
            <li><Link href="/series" className="hover:text-white">{tn("series")}</Link></li>
            <li><Link href="/news" className="hover:text-white">{tn("news")}</Link></li>
            <li><Link href="/about" className="hover:text-white">{tn("about")}</Link></li>
          </ul>
        </div>

        <div>
          <div className="font-medium text-white mb-3">{t("contact")}</div>
          <ul className="space-y-2 text-sm text-white/60">
            <li>{ts("tagline")}</li>
            <li>sales@fmw.example</li>
            <li>+86 400-000-0000</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page py-4 text-xs text-white/50">{t("copyright")}</div>
      </div>
    </footer>
  );
}
