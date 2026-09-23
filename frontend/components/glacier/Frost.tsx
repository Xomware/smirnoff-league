export const FONTS =
  "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Figtree:wght@400;500;600;700;800&display=swap";

export function Icicles({ className, d }: { className: string; d: string }) {
  return (
    <svg className={className} aria-hidden="true" viewBox="0 0 400 22" preserveAspectRatio="none">
      <path d={d} />
    </svg>
  );
}

export const HEADER_ICICLES =
  "M0 0H400V2H392L389 12L386 2H360L357 16L354 2H330L327 8L324 2H296L292 18L288 2H262L259 10L256 2H228L224 15L220 2H196L193 9L190 2H162L158 17L154 2H128L125 10L122 2H96L92 14L88 2H62L59 8L56 2H30L26 16L22 2H0Z";
export const PANEL_ICICLES =
  "M0 0H400V3H394L391 15L388 3H372L368 20L364 3H340L337 11L334 3H310L306 18L302 3H276L273 9L270 3H246L242 21L238 3H214L211 12L208 3H180L176 17L172 3H150L147 10L144 3H118L114 19L110 3H86L83 11L80 3H58L54 16L50 3H28L25 9L22 3H0Z";

export function Crystal() {
  return (
    <svg className="glacier-crystal" aria-hidden="true" viewBox="0 0 60 60">
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none">
        <path d="M30 4V56M7 17L53 43M7 43L53 17" />
        <path d="M30 12L25 7M30 12L35 7M30 48L25 53M30 48L35 53M14 21L8 23M14 21L12 15M46 39L52 37M46 39L48 45M14 39L12 45M14 39L8 37M46 21L48 15M46 21L52 23" />
      </g>
    </svg>
  );
}
