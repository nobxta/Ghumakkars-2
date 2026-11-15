import Image from 'next/image';

// Cleaned, trimmed copy (new name busts the 30-day image cache) of public/wordmar-2.png (1000x140, transparent).
const SRC = '/ghumakkars-wordmark-v2.png';
const W = 1000;
const H = 140;

/**
 * The Ghumakkars wordmark image. Size it with a height class (e.g. "h-7");
 * the width follows the logo's aspect ratio. `white` turns it solid white for
 * dark/coloured backgrounds.
 */
export default function BrandWordmark({
  className = 'h-7',
  white = false,
  priority = false,
}: {
  className?: string;
  white?: boolean;
  priority?: boolean;
}) {
  return (
    <Image
      src={SRC}
      alt="Ghumakkars"
      width={W}
      height={H}
      priority={priority}
      sizes="240px"
      className={`w-auto select-none ${white ? 'brightness-0 invert' : ''} ${className}`}
      draggable={false}
    />
  );
}
