const { createClient, createAccount, generatePrivateKey } = require("genlayer-js");
const { studionet } = require("genlayer-js/chains");
const { TransactionStatus, ExecutionResult } = require("genlayer-js/types");

const CONTRACT_ADDRESS = "0x181eeE5ff3B1186b39f813129d57558Ad61Ff39B";
const GEN = 10n ** 18n;

function newAccount(label) {
  const pk = generatePrivateKey();
  const acc = createAccount(pk);
  return { label, pk, address: acc.address, account: acc };
}

function clientFor(account) {
  return createClient({ chain: studionet, account });
}

async function write(account, functionName, args, value) {
  const client = clientFor(account);
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
    value: value ?? 0n,
  });
  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
  });
  return { hash, receipt };
}

async function read(functionName, args) {
  const client = createClient({ chain: studionet });
  return client.readContract({ address: CONTRACT_ADDRESS, functionName, args: args ?? [] });
}

module.exports = { newAccount, clientFor, write, read, CONTRACT_ADDRESS, GEN, TransactionStatus, ExecutionResult };
