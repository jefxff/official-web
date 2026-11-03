#!/usr/bin/env python3
"""
生成演示用静态资源，并把 seed 测试数据的资源引用改成本地路径。

背景：原 seed 数据的手册 / 封面图指向 `cdn.fmw.example`（示例域名，实际不存在），
而公开页会用 <img src> / <a href> 直接引用它们 —— 不开 CDN 的国内单区域部署下
必然全是裂图与死链。此脚本做两件事：

1) 在 public/ 下生成真实的 PDF 与封面图（内容为演示文案，不是真实产品资料）；
2) 把 seed JSON 里的 cdn.fmw.example 链接改写为 /datasheets、/appnotes、
   /images/news 下的本地路径。

一次性工具，改完数据后可重复执行（幂等）。
用法：python scripts/gen-demo-assets.py
"""

import json
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
SEED = ROOT / "src" / "packages" / "data" / "seed"

BRAND = (29, 95, 214)
BRAND_DARK = (18, 41, 79)
INK = (26, 35, 50)
SUB = (90, 107, 128)

FONT_CN = "C:/Windows/Fonts/msyh.ttc"
FONT_CN_BOLD = "C:/Windows/Fonts/msyhbd.ttc"
FONT_MONO = "C:/Windows/Fonts/consola.ttf"


def load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(path, size)
    except OSError:  # 非 Windows 环境回落到默认字体
        return ImageFont.load_default()


def wrap(draw, text: str, font, max_width: int) -> list[str]:
    """
    按「词」换行：ASCII 词整词不拆（否则 LDO 会被拆成 LD + O），
    中文逐字可断。先切成 token，再做贪心行填充。
    """
    tokens = re.findall(r"[A-Za-z0-9][A-Za-z0-9\.\-\+/&%]*|\s+|.", text)
    lines, cur = [], ""
    for tk in tokens:
        if tk.isspace() and not cur:
            continue
        if draw.textlength(cur + tk, font=font) > max_width and cur.strip():
            lines.append(cur.rstrip())
            cur = "" if tk.isspace() else tk
        else:
            cur += tk
    if cur.strip():
        lines.append(cur.rstrip())
    return lines


def make_cover(path: Path, title: str, tag: str, seed: int) -> None:
    """
    1600x1000（16:10）资讯封面 —— 一块「技术图版」，不含任何正文文案。

    为什么不上标题：一套封面要同时服务中文站与英文站，而 Article 只有一个
    coverImage 字段。把中文标题烙进图片，英文页就会露出中文（反之亦然）。
    所以封面只放语言无关的东西：等距栅格、朱砂同心环、芯片剪影、
    FMW / NEWS 标号与期号。

    上一版只有「栅格 + 环 + 数字」，在白底页面上像一张没画完的占位图。
    这一版把芯片剪影放进去：它是这家公司真正在卖的东西，也让封面与小卡
    里的芯片图形成呼应。
    """
    w, h = 1600, 1000
    num = f"{seed + 1:02d}"

    # 底：竖向渐变，上白下略暖，模拟纸张受光
    img = Image.new("RGB", (w, h), (250, 249, 246))
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / (h - 1)
        draw.line(
            [(0, y), (w, y)],
            fill=(int(252 - 6 * t), int(251 - 6 * t), int(247 - 8 * t)),
        )

    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)

    # 栅格
    for x in range(0, w, 80):
        ld.line([(x, 0), (x, h)], fill=(20, 22, 26, 12), width=1)
    for y in range(0, h, 80):
        ld.line([(0, y), (w, y)], fill=(20, 22, 26, 9), width=1)

    # 芯片位置随期号轻微漂移，五张图不会完全雷同
    bx = 900 + (seed % 3) * 26
    by = 300 + (seed % 3) * 18
    bw = 320
    cx, cy = bx + bw // 2, by + bw // 2

    # 同心环：环心与芯片同心，读到的是「这颗料在测」的语义
    for r, a, wd in ((304, 40, 2), (232, 62, 2), (150, 96, 3)):
        ld.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(200, 68, 43, a), width=wd)

    # 大号期号：贴着右下角，作为图版的「版次」标记
    f_num = load_font(FONT_CN_BOLD, 520)
    nw = ld.textlength(num, font=f_num)
    ld.text((w - 40 - nw, h - 470), num, font=f_num, fill=(20, 22, 26, 12))

    img = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")
    draw = ImageDraw.Draw(img)

    # 工程标注线：横贯芯片左侧，把左半边的空白变成「制图留白」
    dim_y = cy
    draw.line([(96, dim_y), (bx - 56, dim_y)], fill=(20, 22, 26, 70), width=1)
    for tx in (96, bx - 56):
        draw.line([(tx, dim_y - 7), (tx, dim_y + 7)], fill=(20, 22, 26, 70), width=1)
    draw.text((96 + 12, dim_y - 30), "5.00 mm", font=load_font(FONT_MONO, 26), fill=(118, 124, 134))

    # 芯片剪影：塑封体 + 四边引脚 + 一号脚朱砂点
    draw.rounded_rectangle([bx, by, bx + bw, by + bw], radius=10, fill=(26, 29, 35))
    for i in range(7):
        off = 22 + i * 42
        for coords in (
            [bx + off, by - 16, bx + off + 32, by + 6],
            [bx + off, by + bw - 6, bx + off + 32, by + bw + 16],
            [bx - 16, by + off, bx + 6, by + off + 32],
            [bx + bw - 6, by + off, bx + bw + 16, by + off + 32],
        ):
            draw.rectangle(coords, fill=(168, 174, 184))
    draw.ellipse([bx + 28, by + bw - 42, bx + 44, by + bw - 26], fill=(200, 68, 43))
    # 激光打标：只放品牌名，语言无关
    draw.text(
        (bx + bw // 2, by + bw // 2 - 12),
        "FMW",
        font=load_font(FONT_MONO, 40),
        fill=(240, 238, 232),
        anchor="mm",
    )

    f_mono = load_font(FONT_MONO, 26)
    f_mono_s = load_font(FONT_MONO, 20)

    draw.text((96, h - 190), "FMW / NEWS", font=f_mono, fill=(200, 68, 43))
    draw.line([(96, h - 148), (96 + 320, h - 148)], fill=(20, 22, 26, 60), width=2)
    draw.text((96, h - 120), f"PLATE {num} — {2026}", font=f_mono_s, fill=(118, 124, 134))

    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "JPEG", quality=92, optimize=True)


def build_pdf(pages: list[list[str]]) -> bytes:
    """
    构造最小合法 PDF（无第三方依赖）：Helvetica 正文，单栏逐行排版。
    只用 ASCII，避免内置字体缺字形导致乱码。
    """

    # PDF 内置 Helvetica 只覆盖 WinAnsi：先把 Ω / μ / ± 等符号转成 ASCII 写法，
    # 否则 latin-1 编码直接抛错（而不是渲染成缺字方框）。
    SYMBOLS = {
        "Ω": "ohm", "ω": "ohm", "μ": "u", "µ": "u", "±": "+/-",
        "°": "deg", "–": "-", "—": "-", "×": "x", "≤": "<=", "≥": ">=",
        "²": "2", "³": "3", "·": ".", "“": '"', "”": '"', "’": "'",
    }

    def ascii_only(s: str) -> str:
        for k, v in SYMBOLS.items():
            s = s.replace(k, v)
        return s.encode("latin-1", "replace").decode("latin-1")

    def esc(raw: str) -> str:
        s = ascii_only(raw)
        return s.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")

    contents = []
    for lines in pages:
        parts = ["BT", "/F1 11 Tf", "60 780 Td", "16 TL"]
        for i, line in enumerate(lines):
            size = 18 if i == 0 else 11
            parts.append(f"/F1 {size} Tf")
            parts.append(f"({esc(line)}) Tj T*")
        parts.append("ET")
        contents.append("\n".join(parts).encode("latin-1"))

    objs: list[bytes] = []
    n_pages = len(pages)
    # 1 Catalog, 2 Pages, 3 Font, 其后每页两个对象（Page + Contents）
    page_ids = [4 + i * 2 for i in range(n_pages)]
    objs.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    kids = " ".join(f"{pid} 0 R" for pid in page_ids)
    objs.append(f"<< /Type /Pages /Count {n_pages} /Kids [{kids}] >>".encode())
    objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    for i, body in enumerate(contents):
        pid = page_ids[i]
        objs.append(
            (
                f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
                f"/Resources << /Font << /F1 3 0 R >> >> /Contents {pid + 1} 0 R >>"
            ).encode()
        )
        objs.append(b"<< /Length %d >>\nstream\n" % len(body) + body + b"\nendstream")

    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for idx, obj in enumerate(objs, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % idx + obj + b"\nendobj\n"

    xref_pos = len(out)
    n = len(objs) + 1
    out += b"xref\n0 %d\n" % n
    out += b"0000000000 65535 f \n"
    for off in offsets[1:]:
        out += b"%010d 00000 n \n" % off
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (n, xref_pos)
    return bytes(out)


def make_datasheet(path: Path, mpn: str, name_en: str, specs: list[tuple[str, str]], kind: str) -> None:
    if kind == "datasheet":
        lines = [
            f"{mpn} - Preliminary Datasheet",
            "",
            name_en,
            "",
            "Description",
            "  This document is a demo artifact generated for the website preview.",
            "  It contains no production electrical data. Do not use for design.",
            "",
            "Key specifications (demo values)",
        ]
        lines += [f"  {k:<22}{v}" for k, v in specs]
        lines += [
            "",
            "Package / ordering information",
            "  See the product page on the website for the ordering table.",
            "",
            "Notice",
            "  Sample document for demonstration purposes only.",
        ]
    else:
        lines = [
            f"{mpn} - Application Note",
            "",
            f"Layout and thermal guidelines for {mpn}",
            "",
            "1. Scope",
            "  This application note is a demo artifact for website preview.",
            "",
            "2. Recommended layout",
            "  Keep the input capacitor loop as small as possible.",
            "  Use a solid ground plane under the device.",
            "",
            "3. Thermal considerations",
            "  Provide sufficient copper area on the drain / VOUT pads.",
        ]
        lines += ["", "4. Measured values (demo)"] + [f"  {k:<22}{v}" for k, v in specs]

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(build_pdf([lines]))


def main() -> None:
    products = json.loads((SEED / "products.json").read_text(encoding="utf-8"))
    articles = json.loads((SEED / "articles.json").read_text(encoding="utf-8"))
    series = json.loads((SEED / "series.json").read_text(encoding="utf-8"))

    # ---------- 1. 追加测试料号（每个系列各补 1 颗，列表页 9 颗刚好 3 行）----------
    def spec(label_zh: str, label_en: str, value: str) -> dict:
        return {"label": label_zh, "labelEn": label_en, "value": value}

    extra = [
        {
            "id": "p-fm8003",
            "mpn": "FM8003",
            "category": "LDO",
            "seriesId": "srv-ldo",
            "nameZh": "FM8003 300mA 纳安级静态电流 LDO",
            "nameEn": "FM8003 300mA Nano-Power LDO",
            "summaryZh": "静态电流 1.2μA，适合常电待机的电池供电设备。",
            "summaryEn": "1.2μA quiescent current for always-on battery-powered devices.",
            "descriptionZh": "FM8003 面向常电待机的电池设备，静态电流低至 1.2μA，支持 1.8V–5.5V 输入与 300mA 输出，关断电流小于 100nA。",
            "descriptionEn": "Designed for always-on battery devices, the FM8003 offers 1.2μA quiescent current, 1.8V-5.5V input and 300mA output, with shutdown current below 100nA.",
            "specsZh": [
                spec("输入电压", "Input Voltage", "1.8V – 5.5V"),
                spec("输出电流", "Output Current", "300mA"),
                spec("静态电流", "Quiescent Current", "1.2μA"),
                spec("关断电流", "Shutdown Current", "< 100nA"),
                spec("封装", "Package", "SOT-23-5"),
            ],
            "verificationLevel": "DATASHEET",
        },
        {
            "id": "p-fm9003",
            "mpn": "FM9003",
            "category": "PMIC",
            "seriesId": "srv-pmic",
            "nameZh": "FM9003 单节锂电充电 + 升压 PMIC",
            "nameEn": "FM9003 Single-Cell Charger + Boost PMIC",
            "summaryZh": "1A 线性充电与 5V/1A 升压集成，面向 TWS 充电仓。",
            "summaryEn": "1A linear charger plus 5V/1A boost, targeting TWS charging cases.",
            "descriptionZh": "FM9003 集成 1A 线性充电、5V/1A 同步升压与电量指示，外围仅需 6 个元件，适用于 TWS 充电仓与便携小家电。",
            "descriptionEn": "The FM9003 integrates a 1A linear charger, 5V/1A synchronous boost and LED indicators. Only six external components are required, suiting TWS cases and portable appliances.",
            "specsZh": [
                spec("充电电流", "Charge Current", "1A（可编程）"),
                spec("升压输出", "Boost Output", "5V / 1A"),
                spec("输入电压", "Input Voltage", "3.0V – 5.5V"),
                spec("充电截止精度", "CV Accuracy", "±1%"),
                spec("封装", "Package", "QFN-16 3×3"),
            ],
            "verificationLevel": "BENCH_TESTED",
            "verifiedEvidence": "内部实测报告 BR-2026-0207：25°C 下充电电流精度 ±3%，升压效率峰值 93.5%。",
            "verifiedEvidenceEn": "Internal bench report BR-2026-0207: charge current accuracy within ±3% at 25°C, peak boost efficiency 93.5%.",
        },
        {
            "id": "p-fm3003",
            "mpn": "FM3003",
            "category": "MOSFET",
            "seriesId": "srv-mos",
            "nameZh": "FM3003 60V 40A N 沟道 MOSFET",
            "nameEn": "FM3003 60V 40A N-Channel MOSFET",
            "summaryZh": "Rds(on) 8.5mΩ，适用于 48V 电池保护与电机驱动。",
            "summaryEn": "8.5mΩ Rds(on) for 48V battery protection and motor drive.",
            "descriptionZh": "FM3003 为 60V 耐压 N 沟道功率 MOSFET，导通电阻 8.5mΩ，栅极电荷 18nC，适合 48V 电池保护板与低压电机驱动。",
            "descriptionEn": "A 60V N-channel power MOSFET with 8.5mΩ Rds(on) and 18nC gate charge, suited to 48V battery protection boards and low-voltage motor drives.",
            "specsZh": [
                spec("耐压 Vds", "Vds", "60V"),
                spec("连续电流", "Continuous Current", "40A"),
                spec("导通电阻", "Rds(on)", "8.5mΩ @ 10V"),
                spec("栅极电荷", "Qg", "18nC"),
                spec("封装", "Package", "PDFN5×6"),
            ],
            "verificationLevel": "BENCH_TESTED",
            "verifiedEvidence": "内部实测报告 BR-2026-0188：125°C 下 Rds(on) 上升 21%，满足降额要求。",
            "verifiedEvidenceEn": "Internal bench report BR-2026-0188: Rds(on) rises 21% at 125°C, within derating limits.",
        },
    ]

    by_mpn = {p["mpn"]: p for p in products}
    for item in extra:
        # 新增料号的英文参数表由中文表的 labelEn 派生，避免两处维护
        if "specsEn" not in item:
            item["specsEn"] = [
                {"label": s["labelEn"], "labelEn": s["labelEn"], "value": s["value"]}
                for s in item["specsZh"]
            ]
        if item["mpn"] not in by_mpn:
            products.append(item)
    # 按系列分组、组内按料号排序：列表页呈现「LDO → PMIC → MOSFET」的连贯顺序
    series_order = {s["id"]: i for i, s in enumerate(series)}
    products.sort(key=lambda p: (series_order.get(p["seriesId"], 99), p["mpn"]))

    # ---------- 2. 追加资讯 ----------
    extra_articles = [
        {
            "id": "a-fm9003-sampling",
            "slug": "fm9003-sampling",
            "titleZh": "FM9003 充电升压二合一 PMIC 开放样片申请",
            "titleEn": "FM9003 Charger + Boost PMIC Now Sampling",
            "excerptZh": "单颗芯片集成 1A 线性充电与 5V/1A 同步升压，外围仅需 6 个元件。",
            "excerptEn": "A single die combining a 1A linear charger and 5V/1A synchronous boost, with only six external components.",
            "bodyZh": "## 一颗芯片解决充电与升压\n\n针对 TWS 充电仓、便携小家电这类「小电池 + 需要 5V 输出」的场景，FM9003 把 **1A 线性充电** 与 **5V/1A 同步升压** 集成到同一颗 QFN-16 封装内。\n\n## 关键指标\n\n- 充电电流 1A，可通过电阻编程，CV 精度 ±1%\n- 升压输出 5V/1A，峰值效率 93.5%\n- 静态电流 18μA，待机不掏空电池\n- 外围仅需 6 个元件，BOM 面积较分立方案减少约 40%\n\n## 评估板\n\nFM9003 EVB 现已可申请，包含原理图、BOM 与实测波形。样片与评估板可通过「联系我们」提交需求。\n\n详见 [FM9003 料号页](/zh/products/FM9003)。",
            "bodyEn": "## Charging and boosting in one die\n\nFor TWS charging cases and portable appliances that pair a small cell with a 5V rail, the FM9003 combines a **1A linear charger** and a **5V/1A synchronous boost** in a single QFN-16 package.\n\n## Key metrics\n\n- 1A programmable charge current, ±1% CV accuracy\n- 5V/1A boost output, 93.5% peak efficiency\n- 18μA quiescent current keeps standby drain low\n- Six external components; about 40% smaller BOM area than a discrete solution\n\n## Evaluation board\n\nThe FM9003 EVB is available with schematics, BOM and measured waveforms. Request samples through Contact.\n\nSee the [FM9003 part page](/en/products/FM9003).",
            "coverImage": "/images/news/fm9003-sampling.jpg",
            "publishedAt": "2026-10-08T09:00:00.000Z",
        },
        {
            "id": "a-quality-lab",
            "slug": "reliability-lab",
            "titleZh": "可靠性实验室完成新一轮设备扩容",
            "titleEn": "Reliability Lab Completes Equipment Expansion",
            "excerptZh": "新增高低温循环箱与功率器件动态测试台，覆盖 −55°C 至 175°C 全温区验证。",
            "excerptEn": "New thermal cycling chambers and a dynamic power-device test bench extend coverage from -55°C to 175°C.",
            "bodyZh": "## 扩容内容\n\n为支撑车规与工业级产品的验证需求，可靠性实验室本轮新增：\n\n1. 三台高低温循环箱，温区扩展至 **−55°C ~ 175°C**\n2. 功率器件动态测试台，支持双脉冲与短路耐受测试\n3. 在线参数漂移监测系统，循环过程中自动记录 Rds(on) 与 Vth\n\n## 对客户的意义\n\n此前车规项目的全温区验证需外送第三方实验室，周期约 6 周；扩容后内部可完成大部分项目，样片验证周期缩短至 2 周以内。认证类报告仍需第三方出具。\n\n具体的验证等级说明见各料号页的「验证证据」字段。",
            "bodyEn": "## What was added\n\nTo support automotive and industrial qualification, the reliability lab added:\n\n1. Three thermal cycling chambers, extending range to **-55°C to 175°C**\n2. A dynamic power-device bench supporting double-pulse and short-circuit withstand tests\n3. In-line parameter drift monitoring that logs Rds(on) and Vth during cycling\n\n## What it means for customers\n\nFull-temperature validation for automotive projects previously took about six weeks at an external lab. Most projects can now be run in-house, cutting sample validation to under two weeks. Certification reports are still issued by third parties.\n\nSee the \"verification evidence\" field on each part page for the verification level definitions.",
            "coverImage": "/images/news/reliability-lab.jpg",
            "publishedAt": "2026-06-18T09:00:00.000Z",
        },
    ]
    existing_slugs = {a["slug"] for a in articles}
    for item in extra_articles:
        if item["slug"] not in existing_slugs:
            articles.append(item)
    articles.sort(key=lambda a: a["publishedAt"], reverse=True)

    # ---------- 3. 改写资源引用为本地路径 ----------
    for p in products:
        p["datasheetUrl"] = f"/datasheets/{p['mpn']}.pdf"
        p["appNoteUrl"] = f"/appnotes/{p['mpn']}_AN.pdf"

    for a in articles:
        if not a.get("coverImage") or "cdn.fmw.example" in a["coverImage"]:
            a["coverImage"] = f"/images/news/{a['slug']}.jpg"

    # 字段顺序与既有数据保持一致，diff 才不会整篇重排
    order = [
        "id", "mpn", "category", "seriesId",
        "nameZh", "nameEn", "summaryZh", "summaryEn",
        "descriptionZh", "descriptionEn",
        "specsZh", "specsEn", "datasheetUrl", "appNoteUrl",
        "verificationLevel", "verifiedEvidence", "verifiedEvidenceEn",
    ]
    products = [{k: p[k] for k in order if k in p} for p in products]

    aorder = [
        "id", "slug", "titleZh", "titleEn", "excerptZh", "excerptEn",
        "bodyZh", "bodyEn", "coverImage", "publishedAt",
    ]
    articles = [{k: a[k] for k in aorder if k in a} for a in articles]

    # ---------- 4. 生成静态资源 ----------
    for p in products:
        specs = [(s["labelEn"][:22], s["value"]) for s in p["specsEn"]]
        make_datasheet(PUBLIC / "datasheets" / f"{p['mpn']}.pdf", p["mpn"], p["nameEn"], specs, "datasheet")
        make_datasheet(PUBLIC / "appnotes" / f"{p['mpn']}_AN.pdf", p["mpn"], p["nameEn"], specs, "appnote")

    for i, a in enumerate(articles):
        # 封面统一用「新闻动态」栏目标签（文章本身没有分类字段）
        make_cover(PUBLIC / a["coverImage"].lstrip("/"), a["titleZh"], "新闻动态", seed=i)

    # newline="\n" 强制 LF：Windows 下默认会写成 CRLF，导致 git diff 整篇重排
    for name, data in (("products.json", products), ("articles.json", articles)):
        with open(SEED / name, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(json.dumps(data, ensure_ascii=False, indent=2) + "\n")

    print(f"products={len(products)} articles={len(articles)}")
    print("pdfs:", len(list((PUBLIC / 'datasheets').glob('*.pdf'))), "+",
          len(list((PUBLIC / 'appnotes').glob('*.pdf'))))
    print("covers:", len(list((PUBLIC / 'images' / 'news').glob('*.jpg'))))


if __name__ == "__main__":
    main()
