/**
 * Expo's types declare CSS modules but not images, so a bundled asset import
 * has no type. Metro turns each `import`/`require` of an asset into an opaque
 * numeric registry id, which is what RN's and expo-image's `source` accept.
 */
declare module "*.png" {
  const asset: number;
  export default asset;
}

declare module "*.jpg" {
  const asset: number;
  export default asset;
}

declare module "*.webp" {
  const asset: number;
  export default asset;
}
