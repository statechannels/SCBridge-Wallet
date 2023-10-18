// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_ALICE_SK: string;
  readonly VITE_ALICE_ADDRESS: string;
  readonly VITE_PROVIDER: string;
  readonly VITE_BOB_SK: string;
  readonly VITE_BOB_ADDRESS: string;
  readonly VITE_IRENE_SK: string;
  readonly VITE_IRENE_ADDRESS: string;
  readonly VITE_DEPLOY_SALT_STRING: string;
  readonly VITE_ENTRYPOINT_ADDRESS: string;
  readonly VITE_ALICE_SCW_ADDRESS: string;
  readonly VITE_BOB_SCW_ADDRESS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
