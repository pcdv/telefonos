// What the page uses of qrcode-generator 1.4.4 (its qrcode.d.ts), which it loads from a CDN (the import
// map of index.html): for the type check only.
declare module 'qrcode-generator' {
  interface QRCode {
    addData(data: string): void;
    make(): void;
    getModuleCount(): number;
    isDark(row: number, col: number): boolean;
  }

  const qrcode: (typeNumber: 0, errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H') => QRCode;
  export default qrcode;
}
