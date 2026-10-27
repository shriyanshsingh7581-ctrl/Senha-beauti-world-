import React, { useState } from 'react';

interface LuxuryArtCanvasProps {
  imageUrl?: string;
  alt: string;
  variant?:
    | 'hero'
    | 'bridal'
    | 'skin'
    | 'hair'
    | 'massage'
    | 'draping'
    | 'before'
    | 'after';
  className?: string;
  badgeText?: string;
}

/**
 * Renders either a real Cloudinary/uploaded high-res image (with automatic zero-broken-image fallback)
 * OR a bespoke museum-grade SVG luxury beauty illustration in Obsidian, Rose Gold (#E0A996), and Champagne Gold (#D4AF37).
 */
export const LuxuryArtCanvas: React.FC<LuxuryArtCanvasProps> = ({
  imageUrl,
  alt,
  variant = 'bridal',
  className = 'w-full h-full',
}) => {
  const [imgError, setImgError] = useState(false);

  const isCustomUploadedUrl =
    Boolean(imageUrl) &&
    !imgError &&
    (imageUrl!.startsWith('http://') ||
      imageUrl!.startsWith('https://') ||
      imageUrl!.startsWith('data:image/'));

  // Infer visual motif from art: key or variant prop
  const resolvedVariant = (() => {
    if (!imageUrl) return variant;
    if (imageUrl.includes('skin') || imageUrl.includes('hydra') || imageUrl.includes('o3')) return 'skin';
    if (imageUrl.includes('hair') || imageUrl.includes('botoplex')) return 'hair';
    if (imageUrl.includes('spa') || imageUrl.includes('aroma') || imageUrl.includes('polishing')) return 'massage';
    if (imageUrl.includes('draping')) return 'draping';
    if (imageUrl.includes('bridal')) return 'bridal';
    return variant;
  })();

  if (isCustomUploadedUrl) {
    return (
      <div className={`relative overflow-hidden bg-[#121117] ${className}`}>
        <img
          src={imageUrl}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0D0D11]/85 via-[#0D0D11]/20 to-transparent" />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-[#121117] select-none ${className}`}
      role="img"
      aria-label={alt}
    >
      {/* Ambient Radial Luxury Glow */}
      <svg
        viewBox="0 0 600 450"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="obsidianGlow" cx="50%" cy="38%" r="65%">
            <stop offset="0%" stopColor="#2E2024" />
            <stop offset="52%" stopColor="#16141C" />
            <stop offset="100%" stopColor="#0D0D11" />
          </radialGradient>
          <linearGradient id="roseGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F5D6C8" />
            <stop offset="45%" stopColor="#E0A996" />
            <stop offset="100%" stopColor="#A66E5C" />
          </linearGradient>
          <linearGradient id="champagneGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFF1C1" />
            <stop offset="50%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#8E6E18" />
          </linearGradient>
          <linearGradient id="silkCrimson" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4A1924" />
            <stop offset="60%" stopColor="#240D14" />
            <stop offset="100%" stopColor="#0D0D11" />
          </linearGradient>
        </defs>

        {/* Base Velvet Canvas */}
        <rect width="600" height="450" fill="url(#obsidianGlow)" />

        {/* Subtle Architectural Arch & Mandala Filigree */}
        <path
          d="M 150 450 L 150 185 A 150 150 0 0 1 450 185 L 450 450"
          stroke="url(#champagneGoldGrad)"
          strokeWidth="1.2"
          strokeOpacity="0.32"
          fill="url(#silkCrimson)"
          fillOpacity="0.35"
        />
        <path
          d="M 168 450 L 168 190 A 132 132 0 0 1 432 190 L 432 450"
          stroke="url(#roseGoldGrad)"
          strokeWidth="0.75"
          strokeDasharray="4 6"
          strokeOpacity="0.28"
        />

        {/* Halo Rings */}
        <circle
          cx="300"
          cy="195"
          r="112"
          stroke="url(#champagneGoldGrad)"
          strokeWidth="0.9"
          strokeOpacity="0.28"
        />
        <circle
          cx="300"
          cy="195"
          r="88"
          stroke="url(#roseGoldGrad)"
          strokeWidth="0.7"
          strokeOpacity="0.22"
        />

        {resolvedVariant === 'bridal' || resolvedVariant === 'hero' ? (
          <g>
            {/* Editorial Bridal Silhouette & Royal Maang Tikka / Nath Jewelry */}
            <path
              d="M 215 430 C 225 335, 255 305, 300 305 C 345 305, 375 335, 385 430"
              fill="#1E161B"
              stroke="url(#champagneGoldGrad)"
              strokeWidth="1.5"
            />
            {/* Zari Bridal Veil Drape */}
            <path
              d="M 185 440 C 195 270, 230 100, 300 100 C 370 100, 405 270, 415 440"
              stroke="url(#roseGoldGrad)"
              strokeWidth="1.8"
              strokeOpacity="0.65"
              fill="none"
            />
            {/* Sculpted Face Silhouette */}
            <path
              d="M 262 185 C 262 145, 338 145, 338 185 C 338 228, 318 256, 300 262 C 282 256, 262 228, 262 185 Z"
              fill="#2B1F22"
              stroke="url(#roseGoldGrad)"
              strokeWidth="1.4"
            />
            {/* Mathapatti & Maang Tikka */}
            <path
              d="M 262 166 Q 281 178 300 162 Q 319 178 338 166"
              stroke="url(#champagneGoldGrad)"
              strokeWidth="2"
              fill="none"
            />
            <line
              x1="300"
              y1="135"
              x2="300"
              y2="168"
              stroke="url(#champagneGoldGrad)"
              strokeWidth="1.8"
            />
            <circle cx="300" cy="171" r="4.5" fill="url(#champagneGoldGrad)" />
            {/* Bridal Kohl Eyes & Rose Gold Shimmer */}
            <path
              d="M 274 196 Q 284 190 293 196 Q 284 200 274 196 Z"
              fill="url(#roseGoldGrad)"
            />
            <path
              d="M 307 196 Q 316 190 326 196 Q 316 200 307 196 Z"
              fill="url(#roseGoldGrad)"
            />
            {/* Royal Bridal Nath (Nose Ring) */}
            <circle
              cx="315"
              cy="220"
              r="11"
              stroke="url(#champagneGoldGrad)"
              strokeWidth="1.4"
              fill="none"
            />
            <path
              d="M 326 222 Q 335 225 338 214"
              stroke="url(#champagneGoldGrad)"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            {/* Kundan Choker Necklace */}
            <path
              d="M 268 282 Q 300 302 332 282"
              stroke="url(#champagneGoldGrad)"
              strokeWidth="4"
              fill="none"
            />
            <path
              d="M 260 294 Q 300 320 340 294"
              stroke="url(#roseGoldGrad)"
              strokeWidth="2"
              strokeDasharray="4 4"
              fill="none"
            />
            {/* Jhumka Earrings */}
            <path
              d="M 252 215 L 244 232 L 260 232 Z"
              fill="url(#champagneGoldGrad)"
            />
            <path
              d="M 348 215 L 340 232 L 356 232 Z"
              fill="url(#champagneGoldGrad)"
            />
          </g>
        ) : resolvedVariant === 'skin' ? (
          <g>
            {/* Luxury Elixir Dropper Bottle & Hydro-Glow Rings */}
            <ellipse
              cx="300"
              cy="340"
              rx="95"
              ry="22"
              fill="#1B1822"
              stroke="url(#champagneGoldGrad)"
              strokeWidth="1.2"
            />
            {/* Serum Bottle */}
            <rect
              x="266"
              y="195"
              width="68"
              height="125"
              rx="14"
              fill="#261B1F"
              stroke="url(#roseGoldGrad)"
              strokeWidth="1.8"
            />
            {/* Inner Gold Elixir */}
            <rect
              x="273"
              y="225"
              width="54"
              height="88"
              rx="9"
              fill="url(#champagneGoldGrad)"
              fillOpacity="0.28"
            />
            {/* Metallic Collar */}
            <rect
              x="282"
              y="172"
              width="36"
              height="23"
              rx="3"
              fill="url(#champagneGoldGrad)"
            />
            {/* Pipette Bulb */}
            <path
              d="M 288 172 L 288 145 C 288 132, 312 132, 312 145 L 312 172 Z"
              fill="url(#roseGoldGrad)"
            />
            {/* Floating Golden Dew Drops */}
            <path
              d="M 215 180 C 215 180, 203 198, 203 206 A 12 12 0 1 0 227 206 C 227 198, 215 180, 215 180 Z"
              fill="url(#champagneGoldGrad)"
              fillOpacity="0.7"
            />
            <path
              d="M 385 160 C 385 160, 375 175, 375 182 A 10 10 0 1 0 395 182 C 395 175, 385 160, 385 160 Z"
              fill="url(#roseGoldGrad)"
              fillOpacity="0.75"
            />
          </g>
        ) : resolvedVariant === 'hair' ? (
          <g>
            {/* Flowing Silk Waves & Golden Floral Comb */}
            <path
              d="M 240 110 C 190 175, 340 235, 235 340 C 195 380, 260 420, 300 435"
              stroke="url(#roseGoldGrad)"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M 275 105 C 225 175, 375 235, 270 340 C 230 380, 295 420, 330 435"
              stroke="url(#champagneGoldGrad)"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M 315 105 C 265 175, 415 235, 310 340 C 270 380, 335 420, 365 435"
              stroke="url(#roseGoldGrad)"
              strokeWidth="2.5"
              strokeOpacity="0.75"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M 350 115 C 300 185, 445 245, 345 350"
              stroke="url(#champagneGoldGrad)"
              strokeWidth="1.8"
              strokeOpacity="0.55"
              fill="none"
              strokeLinecap="round"
            />
            {/* Hair Comb Ornament */}
            <rect
              x="255"
              y="150"
              width="90"
              height="10"
              rx="5"
              fill="url(#champagneGoldGrad)"
            />
            <circle cx="275" cy="146" r="6" fill="url(#roseGoldGrad)" />
            <circle cx="300" cy="143" r="8" fill="url(#champagneGoldGrad)" />
            <circle cx="325" cy="146" r="6" fill="url(#roseGoldGrad)" />
          </g>
        ) : resolvedVariant === 'massage' ? (
          <g>
            {/* Botanical Lotus & Warm Spa Stones */}
            <ellipse
              cx="300"
              cy="325"
              rx="85"
              ry="26"
              fill="#1E1B24"
              stroke="url(#roseGoldGrad)"
              strokeWidth="1.5"
            />
            <ellipse
              cx="300"
              cy="295"
              rx="64"
              ry="20"
              fill="#27222E"
              stroke="url(#champagneGoldGrad)"
              strokeWidth="1.4"
            />
            {/* Sculpted Lotus Petals */}
            <path
              d="M 300 135 C 275 180, 270 230, 300 268 C 330 230, 325 180, 300 135 Z"
              fill="url(#roseGoldGrad)"
              fillOpacity="0.45"
              stroke="url(#champagneGoldGrad)"
              strokeWidth="1.5"
            />
            <path
              d="M 300 268 C 255 255, 225 215, 235 170 C 265 185, 285 220, 300 268 Z"
              fill="url(#roseGoldGrad)"
              fillOpacity="0.3"
              stroke="url(#roseGoldGrad)"
              strokeWidth="1.3"
            />
            <path
              d="M 300 268 C 345 255, 375 215, 365 170 C 335 185, 315 220, 300 268 Z"
              fill="url(#roseGoldGrad)"
              fillOpacity="0.3"
              stroke="url(#roseGoldGrad)"
              strokeWidth="1.3"
            />
          </g>
        ) : (
          <g>
            {/* Saree Draping Geometric Zari Pleats */}
            <path
              d="M 220 115 L 380 115 L 420 420 L 180 420 Z"
              fill="url(#silkCrimson)"
              stroke="url(#champagneGoldGrad)"
              strokeWidth="1.6"
            />
            {/* Precision Box Pleats */}
            <line x1="255" y1="115" x2="235" y2="420" stroke="url(#champagneGoldGrad)" strokeWidth="1.4" />
            <line x1="285" y1="115" x2="275" y2="420" stroke="url(#roseGoldGrad)" strokeWidth="1.4" />
            <line x1="315" y1="115" x2="315" y2="420" stroke="url(#champagneGoldGrad)" strokeWidth="1.4" />
            <line x1="345" y1="115" x2="355" y2="420" stroke="url(#roseGoldGrad)" strokeWidth="1.4" />
            {/* Royal Gold Kamarbandh (Waist Belt) */}
            <path
              d="M 212 225 Q 300 250 388 225"
              stroke="url(#champagneGoldGrad)"
              strokeWidth="6"
              fill="none"
            />
            <circle cx="300" cy="238" r="9" fill="url(#roseGoldGrad)" />
            {/* Zari Border Motifs */}
            <path
              d="M 185 385 L 415 385"
              stroke="url(#champagneGoldGrad)"
              strokeWidth="8"
              strokeDasharray="10 6"
            />
          </g>
        )}
      </svg>

      {/* Measured Contrast Scrim */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0D0D11] via-[#0D0D11]/35 to-transparent" />
    </div>
  );
};
