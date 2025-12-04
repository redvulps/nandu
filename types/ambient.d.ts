declare function _(id: string): string;
declare function print(args: string): void;
declare function log(obj: object, others?: object[]): void;
declare function log(msg: string, subsitutions?: any[]): void;

declare const pkg: {
  version: string;
  name: string;
};

declare module console {
  export function error(obj: object, others?: object[]): void;
  export function error(msg: string, subsitutions?: any[]): void;
}

declare interface String {
  format(...replacements: string[]): string;
  format(...replacements: number[]): string;
}
declare interface Number {
  toFixed(digits: number): number;
}

// Browser APIs that we polyfill or use equivalents for
declare class TextEncoder {
  encode(input: string): Uint8Array;
}

declare class TextDecoder {
  decode(input: Uint8Array): string;
}

declare function setTimeout(callback: () => void, delay: number): number;
