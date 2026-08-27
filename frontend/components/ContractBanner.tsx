import { isContractConfigured } from "@/lib/env";

export function ContractBanner() {
  if (isContractConfigured()) return null;
  return (
    <div className="border-b border-tertiary-container bg-tertiary-container px-4 py-2.5 text-center text-sm font-medium text-on-tertiary-container sm:px-8">
      The WitnessMark contract address isn&apos;t configured yet (NEXT_PUBLIC_CONTRACT_ADDRESS is empty). Reads and
      transactions are disabled until it is deployed and set.
    </div>
  );
}
