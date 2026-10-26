"use client";

/**
 * GlassFilterDefs
 *
 * Injects a hidden <svg> with <defs> containing SVG filters that implement a
 * real liquid-glass refraction effect for the Glass skin. The filters are
 * referenced from CSS via `backdrop-filter: url(#glass-refract)` and
 * `backdrop-filter: url(#glass-refract-strong)`.
 *
 * Pipeline per filter:
 *   1. feGaussianBlur    — slight smoothing on the input backdrop
 *   2. feImage           — static radial-gradient data URI used as the
 *                          displacement normal map (R + G drive x/y bend)
 *   3. feDisplacementMap — primary refraction bend
 *   4. Three parallel feDisplacementMap passes at slightly different scales,
 *      masked to one channel each via feColorMatrix, to split R / G / B for
 *      chromatic aberration at the glass edges.
 *   5. feBlend mode="screen" chain — recombine the three channel passes.
 *   6. feComponentTransfer — tone table that lifts midtones and crushes
 *      blacks slightly for a glassy light response.
 */

// Static radial-gradient normal map encoded as a data: URI. The red and green
// channels sweep across the image so feDisplacementMap can read them as x/y
// displacement vectors. A radial pattern approximates an outward squircle
// refraction without needing per-element baking.
const DISPLACEMENT_MAP =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <defs>
        <radialGradient id="rx" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stop-color="rgb(128,128,128)"/>
          <stop offset="55%" stop-color="rgb(128,128,128)"/>
          <stop offset="100%" stop-color="rgb(255,0,128)"/>
        </radialGradient>
        <radialGradient id="ry" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stop-color="rgb(128,128,128)"/>
          <stop offset="55%" stop-color="rgb(128,128,128)"/>
          <stop offset="100%" stop-color="rgb(0,255,128)"/>
        </radialGradient>
      </defs>
      <rect width="200" height="200" fill="rgb(128,128,128)"/>
      <rect width="200" height="200" fill="url(#rx)" style="mix-blend-mode:screen"/>
      <rect width="200" height="200" fill="url(#ry)" style="mix-blend-mode:screen"/>
    </svg>`,
  );

export const GLASS_REFRACT_ID = "glass-refract";
export const GLASS_REFRACT_STRONG_ID = "glass-refract-strong";

export default function GlassFilterDefs() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      style={{
        position: "absolute",
        width: 0,
        height: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <defs>
        {/* Main glass refraction — panels, chassis, device */}
        <filter
          id={GLASS_REFRACT_ID}
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.6" result="smoothed" />

          <feImage
            href={DISPLACEMENT_MAP}
            x="0"
            y="0"
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            result="dispMap"
          />

          {/* Primary bend */}
          <feDisplacementMap
            in="smoothed"
            in2="dispMap"
            scale="20"
            xChannelSelector="R"
            yChannelSelector="G"
            result="bent"
          />

          {/* Red channel — biggest bend */}
          <feDisplacementMap
            in="bent"
            in2="dispMap"
            scale="24"
            xChannelSelector="R"
            yChannelSelector="G"
            result="bentR"
          />
          <feColorMatrix
            in="bentR"
            type="matrix"
            values="1 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="chanR"
          />

          {/* Green channel — medium bend */}
          <feDisplacementMap
            in="bent"
            in2="dispMap"
            scale="20"
            xChannelSelector="R"
            yChannelSelector="G"
            result="bentG"
          />
          <feColorMatrix
            in="bentG"
            type="matrix"
            values="0 0 0 0 0
                    0 1 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="chanG"
          />

          {/* Blue channel — smallest bend */}
          <feDisplacementMap
            in="bent"
            in2="dispMap"
            scale="16"
            xChannelSelector="R"
            yChannelSelector="G"
            result="bentB"
          />
          <feColorMatrix
            in="bentB"
            type="matrix"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 1 0 0
                    0 0 0 1 0"
            result="chanB"
          />

          <feBlend in="chanR" in2="chanG" mode="screen" result="rg" />
          <feBlend in="rg" in2="chanB" mode="screen" result="rgb" />

          {/* Glass light response — slight brightness boost + midtone lift */}
          <feComponentTransfer in="rgb" result="lit">
            <feFuncR type="table" tableValues="0 0.08 0.5 0.86 1.04" />
            <feFuncG type="table" tableValues="0 0.08 0.5 0.86 1.04" />
            <feFuncB type="table" tableValues="0 0.08 0.5 0.86 1.06" />
          </feComponentTransfer>
        </filter>

        {/* Strong refraction — buttons / domed jewels */}
        <filter
          id={GLASS_REFRACT_STRONG_ID}
          x="-15%"
          y="-15%"
          width="130%"
          height="130%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.4" result="smoothed" />

          <feImage
            href={DISPLACEMENT_MAP}
            x="0"
            y="0"
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            result="dispMap"
          />

          <feDisplacementMap
            in="smoothed"
            in2="dispMap"
            scale="34"
            xChannelSelector="R"
            yChannelSelector="G"
            result="bent"
          />

          <feDisplacementMap
            in="bent"
            in2="dispMap"
            scale="38"
            xChannelSelector="R"
            yChannelSelector="G"
            result="bentR"
          />
          <feColorMatrix
            in="bentR"
            type="matrix"
            values="1 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="chanR"
          />

          <feDisplacementMap
            in="bent"
            in2="dispMap"
            scale="32"
            xChannelSelector="R"
            yChannelSelector="G"
            result="bentG"
          />
          <feColorMatrix
            in="bentG"
            type="matrix"
            values="0 0 0 0 0
                    0 1 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="chanG"
          />

          <feDisplacementMap
            in="bent"
            in2="dispMap"
            scale="26"
            xChannelSelector="R"
            yChannelSelector="G"
            result="bentB"
          />
          <feColorMatrix
            in="bentB"
            type="matrix"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 1 0 0
                    0 0 0 1 0"
            result="chanB"
          />

          <feBlend in="chanR" in2="chanG" mode="screen" result="rg" />
          <feBlend in="rg" in2="chanB" mode="screen" result="rgb" />

          <feComponentTransfer in="rgb" result="lit">
            <feFuncR type="table" tableValues="0 0.1 0.55 0.9 1.08" />
            <feFuncG type="table" tableValues="0 0.1 0.55 0.9 1.08" />
            <feFuncB type="table" tableValues="0 0.1 0.55 0.9 1.1" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}
