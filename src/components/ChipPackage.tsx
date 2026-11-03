/**
 * 芯片本体绘图（QFN 顶视）。
 *
 * 为什么要有它：卖芯片的官网如果通篇只有文字和表格，看起来就像一家咨询公司。
 * 国内做得好的硬件官网（大疆、兆易、纳芯微）都会让「产品本身」出现在首屏 ——
 * 但真拍照片需要棚拍与修图，而且换料号就得重拍。这里用纯 SVG 画：
 * 塑封体渐变 + 金属焊盘 + 激光打标 + 一号脚标记 + 图纸标注线，
 * 尺寸与配色都按真实器件的观感走，任意 mpn 都能套用。
 *
 * 排版上刻意留了「棚拍」的痕迹：地面投影是椭圆、不是方框阴影，
 * 芯片整体轻微倾斜，避免看起来像一张扁平图标。
 */
export default function ChipPackage({
  mpn = "FM8001",
  batch = "2536",
  packageName = "QFN-28",
  callouts = true,
  className = "",
}: {
  mpn?: string;
  batch?: string;
  packageName?: string;
  callouts?: boolean;
  className?: string;
}) {
  // 焊盘：四边各 7 个（QFN-28）。位置必须落在塑封体（104–336）之内，
  // 两侧各留 24px 边距：128 + 6×28 + 12 = 308，正好贴住右边界的内侧。
  const pads = Array.from({ length: 7 }, (_, i) => 128 + i * 28);

  return (
    <svg
      viewBox="0 0 480 480"
      className={className}
      role="img"
      aria-label={`${mpn} ${packageName} 封装示意`}
    >
      <defs>
        {/* 塑封体：顶部略亮，制造一点点弧面反光 */}
        <linearGradient id="chipBody" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#3a3f48" />
          <stop offset="42%" stopColor="#262a31" />
          <stop offset="100%" stopColor="#171a1f" />
        </linearGradient>
        {/* 塑封体边缘的一圈高光 */}
        <linearGradient id="chipRim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f5f2ec" stopOpacity="0.34" />
          <stop offset="55%" stopColor="#f5f2ec" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#f5f2ec" stopOpacity="0.12" />
        </linearGradient>
        {/* 焊盘：金属冷灰 */}
        <linearGradient id="pad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d7dbe2" />
          <stop offset="45%" stopColor="#a8aeb8" />
          <stop offset="100%" stopColor="#767d88" />
        </linearGradient>
        {/* 地面投影 */}
        <radialGradient id="groundShadow">
          <stop offset="0%" stopColor="#14161a" stopOpacity="0.26" />
          <stop offset="60%" stopColor="#14161a" stopOpacity="0.09" />
          <stop offset="100%" stopColor="#14161a" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 地面投影：椭圆，且比芯片更宽一点，才有「放」在台面上的感觉 */}
      <ellipse cx="248" cy="404" rx="152" ry="26" fill="url(#groundShadow)" />

      {/* 图纸标注：两条引线 + 等宽小字，说明「这是工程件不是插画」 */}
      {callouts && (
        <g stroke="#14161a" strokeOpacity="0.28" strokeWidth="1">
          <path d="M118 324 h-40 v26" fill="none" />
          <path d="M344 120 h42 v-22" fill="none" />
          <circle cx="118" cy="324" r="2.4" fill="#c8442b" stroke="none" />
          <circle cx="344" cy="120" r="2.4" fill="#c8442b" stroke="none" />
        </g>
      )}
      {callouts && (
        <g
          fill="#767c86"
          fontFamily="JetBrains Mono, monospace"
          fontSize="11"
          letterSpacing="1.6"
        >
          <text x="40" y="384">
            PIN 1
          </text>
          <text x="40" y="398">
            {packageName}
          </text>
          <text x="394" y="82">
            {batch}
          </text>
        </g>
      )}

      {/* 芯片本体：轻微 -6° 旋转 */}
      <g transform="rotate(-6 240 240)">
        {/* 焊盘 */}
        <g fill="url(#pad)">
          {pads.map((p) => (
            <g key={p}>
              {/* 引脚是「窄而长」的：切向 12、径向 20，露出本体 8px、压进去 12px */}
              <rect x={p} y="96" width="12" height="20" rx="1" />
              <rect x={p} y="324" width="12" height="20" rx="1" />
              <rect x="96" y={p} width="20" height="12" rx="1" />
              <rect x="324" y={p} width="20" height="12" rx="1" />
            </g>
          ))}
        </g>

        {/* 塑封体 */}
        <rect
          x="104"
          y="104"
          width="232"
          height="232"
          rx="7"
          fill="url(#chipBody)"
        />
        <rect
          x="104.5"
          y="104.5"
          width="231"
          height="231"
          rx="7"
          fill="none"
          stroke="url(#chipRim)"
        />

        {/* 激光打标：低对比度，像真的打在塑封料上 */}
        <g
          fill="#f5f2ec"
          textAnchor="middle"
          fontFamily="JetBrains Mono, monospace"
        >
          <text x="220" y="176" fontSize="13" letterSpacing="5" opacity="0.52">
            FMW
          </text>
          <text x="220" y="216" fontSize="29" letterSpacing="1" opacity="0.82">
            {mpn}
          </text>
          <line
            x1="150"
            y1="236"
            x2="290"
            y2="236"
            stroke="#f5f2ec"
            strokeOpacity="0.28"
          />
          <text x="220" y="262" fontSize="12" letterSpacing="2.4" opacity="0.5">
            {batch} · CN
          </text>
        </g>

        {/* 一号脚：朱砂圆点 + 塑封体倒角，双重标记 */}
        <circle cx="130" cy="312" r="4.5" fill="#c8442b" />
        <path d="M104 322 v9 a7 7 0 0 0 7 7 h9" fill="none" stroke="#565c66" />
      </g>
    </svg>
  );
}
