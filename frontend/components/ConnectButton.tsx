"use client";

import { useWallet } from "@/hooks/useWallet";
import { truncateAddress } from "@/lib/format";
import { Button } from "./ui";

export function ConnectButton() {
  const { address, isConnected, connect } = useWallet();

  if (isConnected && address) {
    return (
      <Button variant="outline" onClick={connect} className="font-mono-data">
        <span className="h-1.5 w-1.5 rounded-full bg-secondary" aria-hidden="true" />
        {truncateAddress(address)}
      </Button>
    );
  }

  return (
    <Button variant="primary" onClick={connect}>
      Connect wallet
    </Button>
  );
}
