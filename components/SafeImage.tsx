'use client';

import type { ImgHTMLAttributes } from 'react';

type Props = ImgHTMLAttributes<HTMLImageElement> & { hideParent?: boolean };

// <img> that removes itself (or its wrapper card) from the layout if the file
// fails to load, so a dead third-party image never shows up as a broken card.
export default function SafeImage({ hideParent = true, ...props }: Props) {
  const hide = (img: HTMLImageElement) => {
    const el = hideParent ? img.parentElement : img;
    if (el) el.style.display = 'none';
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img
      loading="lazy"
      decoding="async"
      {...props}
      // The image may have already failed before React hydrated, in which case
      // onError never fires — catch that case when the element mounts.
      ref={(img) => {
        if (img && img.complete && img.naturalWidth === 0) hide(img);
      }}
      onError={(e) => hide(e.currentTarget)}
    />
  );
}
