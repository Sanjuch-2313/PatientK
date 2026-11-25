function AnatomicalHeart({ active = false, heartRate = null }) {
  const beatDuration = typeof heartRate === "number" && heartRate > 0
    ? `${Math.max(0.55, Math.min(1.6, 60 / heartRate))}s`
    : "1.2s";

  return (
    <svg
      className={`anatomical-heart-svg ${active ? "beating" : ""}`}
      style={{ "--heart-beat-duration": beatDuration }}
      viewBox="0 0 360 400"
      role="img"
      aria-label="Anatomical heart visualization"
    >
      <defs>
        <radialGradient id="heartShadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(180, 45, 35, 0.22)" />
          <stop offset="70%" stopColor="rgba(180, 45, 35, 0.06)" />
          <stop offset="100%" stopColor="rgba(180, 45, 35, 0)" />
        </radialGradient>
        <radialGradient id="ventricleGrad" cx="38%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#e85a4a" />
          <stop offset="40%" stopColor="#c42b23" />
          <stop offset="82%" stopColor="#861412" />
          <stop offset="100%" stopColor="#580a0a" />
        </radialGradient>
        <radialGradient id="rightAtriumGrad" cx="40%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#d94e40" />
          <stop offset="55%" stopColor="#9c1c19" />
          <stop offset="100%" stopColor="#610c0c" />
        </radialGradient>
        <linearGradient id="aortaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f06854" />
          <stop offset="45%" stopColor="#bf2721" />
          <stop offset="100%" stopColor="#6f1010" />
        </linearGradient>
        <linearGradient id="pulmonaryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#668ec2" />
          <stop offset="50%" stopColor="#3c5e91" />
          <stop offset="100%" stopColor="#20375c" />
        </linearGradient>
        <linearGradient id="venaCavaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4f74a8" />
          <stop offset="55%" stopColor="#304f7c" />
          <stop offset="100%" stopColor="#1b3052" />
        </linearGradient>
        <linearGradient id="coronaryRed" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff8b78" />
          <stop offset="100%" stopColor="#b8241d" />
        </linearGradient>
        <linearGradient id="coronaryBlue" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#75a3df" />
          <stop offset="100%" stopColor="#264778" />
        </linearGradient>
        <filter id="softGlow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="14" stdDeviation="12" floodColor="#7c1614" floodOpacity="0.22" />
        </filter>
      </defs>

      {/* Ambient floor shadow */}
      <ellipse cx="185" cy="368" rx="108" ry="20" fill="url(#heartShadow)" />

      <g filter="url(#softGlow)">
        {/* Superior Vena Cava (left-blue vessel) */}
        <path
          d="M112 46 C108 82, 108 118, 114 148 L142 152 C138 118, 138 82, 140 46 Z"
          fill="url(#venaCavaGrad)"
        />
        <ellipse cx="126" cy="46" rx="14" ry="5.5" fill="#21385e" stroke="#6d94c8" strokeWidth="1.5" />

        {/* Aortic Arch & Branches */}
        <path
          d="M148 158 C144 96, 152 44, 198 40 C236 37, 256 68, 252 118 L224 126 C226 88, 214 70, 196 72 C178 74, 174 106, 178 156 Z"
          fill="url(#aortaGrad)"
        />
        {/* Brachiocephalic, Left Common Carotid, Left Subclavian */}
        <path d="M168 50 L164 20 L180 18 L184 46 Z" fill="url(#aortaGrad)" />
        <ellipse cx="172" cy="19" rx="8" ry="3.5" fill="#701010" stroke="#f27a66" strokeWidth="1.2" />

        <path d="M192 43 L192 14 L207 14 L207 42 Z" fill="url(#aortaGrad)" />
        <ellipse cx="199.5" cy="14" rx="7.5" ry="3.2" fill="#701010" stroke="#f27a66" strokeWidth="1.2" />

        <path d="M216 48 L226 20 L240 25 L230 55 Z" fill="url(#aortaGrad)" />
        <ellipse cx="233" cy="22.5" rx="7.5" ry="3.2" transform="rotate(18 233 22.5)" fill="#701010" stroke="#f27a66" strokeWidth="1.2" />

        {/* Right Atrium */}
        <path
          d="M108 144 C82 162, 74 208, 92 246 C106 274, 134 294, 156 296 L160 156 C142 140, 122 136, 108 144 Z"
          fill="url(#rightAtriumGrad)"
        />

        {/* Main Ventricular Mass */}
        <path
          d="M144 138 C178 118, 236 124, 268 164 C298 202, 294 268, 260 314 C236 344, 206 358, 184 358 C154 358, 118 320, 102 270 C88 226, 106 160, 144 138 Z"
          fill="url(#ventricleGrad)"
        />

        {/* Pulmonary Trunk (curving over front) */}
        <path
          d="M174 176 C168 140, 180 104, 214 96 C244 89, 274 96, 286 106 L276 130 C264 122, 240 118, 220 124 C202 130, 198 152, 202 180 Z"
          fill="url(#pulmonaryGrad)"
        />
        <ellipse cx="281" cy="118" rx="6" ry="13" transform="rotate(18 281 118)" fill="#223a61" stroke="#7ba4d8" strokeWidth="1.4" />

        {/* Left Auricle */}
        <path
          d="M236 136 C256 132, 274 146, 270 166 C266 180, 248 182, 236 172 Z"
          fill="#a9211b"
        />

        {/* 3D Specular Highlights */}
        <ellipse cx="170" cy="212" rx="28" ry="52" transform="rotate(-18 170 212)" fill="rgba(255, 190, 180, 0.14)" />
        <ellipse cx="238" cy="216" rx="18" ry="38" transform="rotate(15 238 216)" fill="rgba(255, 175, 165, 0.12)" />

        {/* Coronary Arteries & Veins (giving realistic anatomical detail) */}
        <path
          d="M186 166 C188 206, 196 244, 206 286 C210 306, 208 328, 198 344"
          fill="none"
          stroke="url(#coronaryRed)"
          strokeWidth="5.5"
          strokeLinecap="round"
        />
        <path
          d="M194 214 C218 228, 238 248, 250 278"
          fill="none"
          stroke="url(#coronaryRed)"
          strokeWidth="3.8"
          strokeLinecap="round"
        />
        <path
          d="M190 248 C170 264, 152 284, 146 308"
          fill="none"
          stroke="url(#coronaryRed)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M196 172 C202 212, 208 248, 218 292 C222 310, 218 328, 210 342"
          fill="none"
          stroke="url(#coronaryBlue)"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
        <path
          d="M144 176 C130 206, 122 238, 128 274"
          fill="none"
          stroke="url(#coronaryBlue)"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      </g>

      {/* Anatomical labels stay attached to the structures they identify. */}
      <g className="heart-labels" aria-hidden="true">
        <path d="M168 39 H82" />
        <text x="78" y="35" textAnchor="end">Aorta</text>

        <path d="M254 108 H310" />
        <text x="314" y="104">Pulmonary artery</text>

        <path d="M112 92 H42" />
        <text x="38" y="88" textAnchor="end">Vena cava</text>

        <path d="M108 188 H32" />
        <text x="28" y="184" textAnchor="end">Right atrium</text>

        <path d="M252 260 H322" />
        <text x="326" y="256">Left ventricle</text>

        <path d="M190 270 H72" />
        <text x="68" y="266" textAnchor="end">Coronary vessels</text>
      </g>
    </svg>
  );
}

export default AnatomicalHeart;
