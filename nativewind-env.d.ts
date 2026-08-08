/// <reference types="nativewind/types" />

// The global stylesheet is imported for its side effect; Metro hands it to the
// NativeWind transformer rather than to TypeScript.
declare module "*.css" {}
