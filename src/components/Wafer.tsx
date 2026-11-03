/**
 * 晶圆 / 裸片示意（纯 SVG + CSS，无图片、无第三方依赖）。
 *
 * 亮场版：硅片本身是银灰的，所以在纸白底上不必加发光 —— 用一圈细刻度、
 * 三圈同心环和一段朱砂扫描弧就够了。它是「关于」页与首屏之外唯一的图形资产，
 * 换成实物照片反而会与其它纯代码绘制的产品图不搭。
 *
 * 动效全部走 transform，外层由 prefers-reduced-motion 兜底。
 */
export default function Wafer({ annotations = true }: { annotations?: boolean }) {
  // 72 根外圈刻度：每 5 根加长，读起来像光刻机的对准标尺
  const ticks = Array.from({ length: 72 }, (_, i) => i);
  // 8×8 焊盘阵列，缺角两处做成「已划片」的缺口
  const pads = Array.from({ length: 64 }, (_, i) => i).filter((i) => i !== 9 && i !== 54);

  return (
    <div className="relative aspect-square w-full max-w-[520px]">
      <svg
        viewBox="0 0 400 400"
        className="relative z-10 h-full w-full"
        role="img"
        aria-label="晶圆与裸片示意图"
      >
        <defs>
          <linearGradient id="dieFace" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f4f2ec" />
            <stop offset="100%" stopColor="#dedbd2" />
          </linearGradient>
          <linearGradient id="scanArc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#c8442b" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#c8442b" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="waferFill" cx="42%" cy="38%" r="62%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="62%" stopColor="#f0eee8" />
            <stop offset="100%" stopColor="#dedbd3" />
          </radialGradient>
        </defs>

        {/* 晶圆本体 */}
        <circle cx="200" cy="200" r="180" fill="url(#waferFill)" stroke="#14161a" strokeOpacity="0.16" />

        {/* 外圈刻度环：90 秒转一圈，慢到只在小腿上被察觉 */}
        <g
          style={{
            transformOrigin: "200px 200px",
            animation: "spin-slow 90s linear infinite",
          }}
          stroke="#14161a"
          strokeOpacity="0.26"
        >
          {ticks.map((i) => {
            const long = i % 5 === 0;
            const angle = (i * 360) / 72;
            return (
              <line
                key={i}
                x1="200"
                y1={long ? 8 : 13}
                x2="200"
                y2="22"
                strokeWidth={long ? 1.2 : 0.7}
                transform={`rotate(${angle} 200 200)`}
              />
            );
          })}
        </g>

        {/* 三圈刻度盘：虚线代表「工艺层」，实线代表「衬底」 */}
        <circle cx="200" cy="200" r="168" fill="none" stroke="#14161a" strokeOpacity="0.1" />
        <circle
          cx="200"
          cy="200"
          r="150"
          fill="none"
          stroke="#14161a"
          strokeOpacity="0.18"
          strokeDasharray="2 6"
        />

        {/* 扫描弧：一段 90° 的朱砂渐变，逆时针慢慢扫过裸片 */}
        <g
          style={{
            transformOrigin: "200px 200px",
            animation: "spin-slow 26s linear infinite reverse",
          }}
        >
          <path d="M200 200 L200 62 A138 138 0 0 1 338 200 Z" fill="url(#scanArc)" opacity="0.5" />
          <circle cx="200" cy="62" r="2.6" fill="#c8442b" />
        </g>

        {/* 对准十字线 */}
        <g stroke="#c8442b" strokeOpacity="0.5">
          <line x1="200" y1="34" x2="200" y2="58" strokeWidth="1" />
          <line x1="200" y1="342" x2="200" y2="366" strokeWidth="1" />
          <line x1="34" y1="200" x2="58" y2="200" strokeWidth="1" />
          <line x1="342" y1="200" x2="366" y2="200" strokeWidth="1" />
        </g>

        {/* 裸片本体：偏移 6px，制造「贴在晶圆上但没对正」的机械感 */}
        <g transform="translate(6 6)">
          <rect
            x="118"
            y="118"
            width="164"
            height="164"
            rx="3"
            fill="url(#dieFace)"
            stroke="#14161a"
            strokeOpacity="0.34"
          />
          {/* 焊盘阵列 */}
          <g fill="#14161a" fillOpacity="0.2">
            {pads.map((i) => {
              const col = i % 8;
              const row = Math.floor(i / 8);
              return (
                <rect
                  key={i}
                  x={132 + col * 18}
                  y={132 + row * 18}
                  width="10"
                  height="10"
                  rx="1"
                />
              );
            })}
          </g>
          {/* 核心逻辑区：朱砂描边，是整张图的视觉重心 */}
          <rect
            x="168"
            y="168"
            width="58"
            height="58"
            rx="2"
            fill="#c8442b"
            fillOpacity="0.1"
            stroke="#c8442b"
            strokeOpacity="0.7"
          />
          <text
            x="197"
            y="202"
            textAnchor="middle"
            fontFamily="JetBrains Mono, monospace"
            fontSize="9"
            letterSpacing="0.1em"
            fill="#c8442b"
          >
            FMW
          </text>
        </g>

        {/* 引线标注：小尺寸下隐藏，否则字比线还密 */}
        {annotations && (
          <g
            fontFamily="JetBrains Mono, monospace"
            fontSize="8"
            letterSpacing="0.02em"
            fill="#767c86"
          >
            <polyline
              points="282,150 316,150 316,132"
              stroke="#767c86"
              strokeOpacity="0.5"
              fill="none"
            />
            <text x="320" y="130">MPN · FM SERIES</text>
            <polyline
              points="118,282 84,282 84,300"
              stroke="#767c86"
              strokeOpacity="0.5"
              fill="none"
            />
            <text x="34" y="312">PACKAGE</text>
          </g>
        )}
      </svg>
    </div>
  );
}
