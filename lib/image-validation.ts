const signatures: Record<string, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
};

export function hasAllowedImageSignature(
  contentType: string,
  bytes: Uint8Array,
) {
  if (contentType === 'image/webp') {
    return (
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
    );
  }
  const signature = signatures[contentType];
  return Boolean(
    signature &&
      bytes.length >= signature.length &&
      signature.every((value, index) => bytes[index] === value),
  );
}
