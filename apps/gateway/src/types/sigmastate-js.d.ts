declare module "sigmastate-js/main" {
  export const ErgoTree$: {
    fromHex: (hex: string) => {
      templateHex?: () => string;
      constants?: () => Array<{
        tpe?: { name?: string };
        data?: unknown;
        toHex?: () => string;
      }>;
      root?: { wrappedValue?: { toString?: () => string } };
      toString?: () => string;
    };
  };
}
