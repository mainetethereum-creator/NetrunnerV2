import { createConfig, http, createStorage, cookieStorage } from "wagmi";
import { base } from "wagmi/chains";
import { baseAccount } from "wagmi/connectors";
import { Attribution } from "ox/erc8021";

// Builder Code — tags all onchain transactions so Base attributes them to CyberBase.
const DATA_SUFFIX = Attribution.toDataSuffix({ codes: ["bc_fvhsn04f"] });

// Wallets:
//  • Base App (mobile)  → baseAccount connector.
//  • Coinbase Wallet browser EXTENSION (PC) → surfaced automatically via EIP-6963
//    multi-injected discovery (default on). The Coinbase Wallet extension (with
//    your Base App seed imported) announces itself as "Coinbase Wallet", and the
//    WalletGate button connects to it by name. This is far more reliable than
//    the Coinbase SDK connector, which kept opening the keys.coinbase Smart
//    Wallet instead of the extension.
export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    baseAccount({ appName: "CyberBase" }),
  ],
  multiInjectedProviderDiscovery: true, // EIP-6963 — auto-detects the extension
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  transports: { [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || undefined) },
  dataSuffix: DATA_SUFFIX,
});
