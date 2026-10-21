import { useEffect, useState } from 'react';
import ImageColors from 'react-native-image-colors';
import { darken } from '../theme/colors';

const FALLBACK = '#3a3a44';

/** Background colour taken from the artwork, darkened enough for white text on top. */
export function useArtworkColor(uri: string | null | undefined): string {
  const [color, setColor] = useState(FALLBACK);

  useEffect(() => {
    if (!uri) {
      setColor(FALLBACK);
      return undefined;
    }
    let cancelled = false;
    ImageColors.getColors(uri, { fallback: FALLBACK, cache: true, key: uri, pixelSpacing: 8 })
      .then((result) => {
        if (cancelled || result.platform !== 'android') return;
        const picked = [result.darkVibrant, result.vibrant, result.dominant, result.muted].find(
          (c) => c && c !== FALLBACK && c !== '#000000',
        );
        setColor(darken(picked ?? FALLBACK, 0.35));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [uri]);

  return color;
}
