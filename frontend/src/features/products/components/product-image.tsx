'use client';

import { useState } from 'react';
import { ImageOff } from 'lucide-react';

export function ProductImage({
  src,
  alt,
  className = '',
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  return failed ? (
    <div
      className={`image-fallback ${className}`}
      role="img"
      aria-label={alt}
    >
      <ImageOff
        size={32}
      />
    </div>
  ) : (
    // Product images are served dynamically by the private backend endpoint.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
