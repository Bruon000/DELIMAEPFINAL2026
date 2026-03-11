export function buildProviderNotConfiguredError(providerName: string) {
  const e = new Error(`fiscal_provider_not_configured:${providerName}`);
  (e as any).code = "fiscal_provider_not_configured";
  return e;
}

export function createNotConfiguredProvider(providerName: string) {
  const err = () => {
    throw buildProviderNotConfiguredError(providerName);
  };

  return {
    async emit() {
      return err();
    },
    async cancel() {
      return err();
    },
    async consult() {
      return err();
    },
    async download() {
      return err();
    },
  };
}
