"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { useWallet } from "@/hooks/useWallet";
import { useContractTx } from "@/hooks/useContractTx";
import { createPromise } from "@/lib/genlayer";
import { Button, Card, EmptyState, Field, inputClasses } from "@/components/ui";
import { TxStatus } from "@/components/TxStatus";
import { CATEGORY_OPTIONS } from "@/lib/constants";
import { genToWei, durationLabel } from "@/lib/format";

const STEPS = ["Statement", "Subject", "Evidence", "Stake", "Review"] as const;
type Step = (typeof STEPS)[number];

interface FormState {
  title: string;
  statement: string;
  conditions: string;
  counterparty: string;
  category: string;
  evidenceRequirements: string;
  stakeGen: string;
  acceptWindowSeconds: number;
  evidenceWindowSeconds: number;
}

const ACCEPT_WINDOW_OPTIONS = [
  { label: "1 day", value: 86400 },
  { label: "3 days", value: 259200 },
  { label: "7 days", value: 604800 },
  { label: "14 days", value: 1209600 },
];

const EVIDENCE_WINDOW_OPTIONS = [
  { label: "7 days", value: 604800 },
  { label: "14 days", value: 1209600 },
  { label: "30 days", value: 2592000 },
  { label: "90 days", value: 7776000 },
];

export default function CreatePromisePage() {
  const router = useRouter();
  const { isConnected, connect, address, contractConfigured } = useWallet();
  const [stepIdx, setStepIdx] = useState(0);
  const [form, setForm] = useState<FormState>({
    title: "",
    statement: "",
    conditions: "",
    counterparty: "",
    category: "goods",
    evidenceRequirements: "",
    stakeGen: "",
    acceptWindowSeconds: 259200,
    evidenceWindowSeconds: 1209600,
  });
  const { run, state, error, txHash } = useContractTx();
  const [createdId, setCreatedId] = useState<number | null>(null);

  const step = STEPS[stepIdx];
  const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const stepValid: Record<Step, boolean> = {
    Statement: form.title.trim().length > 0 && form.statement.trim().length > 0 && form.conditions.trim().length > 0,
    Subject: /^0x[a-fA-F0-9]{40}$/.test(form.counterparty.trim()) && form.counterparty.trim().toLowerCase() !== address?.toLowerCase(),
    Evidence: form.evidenceRequirements.trim().length > 0,
    Stake: Number(form.stakeGen) > 0,
    Review: true,
  };

  const canProceed = stepValid[step];

  async function handleSubmit() {
    const result = await run((args) =>
      createPromise(args, {
        counterparty: form.counterparty.trim(),
        title: form.title.trim(),
        statement: form.statement.trim(),
        conditions: form.conditions.trim(),
        evidenceRequirements: form.evidenceRequirements.trim(),
        category: form.category,
        acceptWindowSeconds: form.acceptWindowSeconds,
        evidenceWindowSeconds: form.evidenceWindowSeconds,
        stakeWei: genToWei(form.stakeGen),
      }),
    );
    if (result !== null && typeof result === "number") {
      setCreatedId(result);
    } else if (result !== null) {
      // some clients return a receipt/dict rather than a raw int; best effort
      const maybeId = (result as { return_value?: number })?.return_value;
      if (typeof maybeId === "number") setCreatedId(maybeId);
    }
  }

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-8">
        <EmptyState
          title="Connect your wallet to create a promise"
          description="You'll sign the create_promise transaction and attach the stake as native GEN value."
          action={
            <button onClick={connect} className="focus-ring rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary">
              Connect wallet
            </button>
          }
        />
      </div>
    );
  }

  if (!contractConfigured) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-8">
        <EmptyState title="Contract not configured" description="Set NEXT_PUBLIC_CONTRACT_ADDRESS before creating promises." />
      </div>
    );
  }

  if (state === "confirmed") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-8">
        <Card className="p-8 text-center">
          <p className="text-lg font-semibold text-on-surface">Promise created</p>
          <p className="mt-2 text-sm text-on-surface-variant">
            Your stake is escrowed. Share the promise with the counterparty so they can accept it.
          </p>
          {txHash ? <p className="font-mono-data mt-3 text-xs text-on-surface-variant">{txHash}</p> : null}
          <div className="mt-6 flex justify-center gap-3">
            {createdId !== null ? (
              <Button onClick={() => router.push(`/promises/${createdId}`)}>View promise</Button>
            ) : (
              <Button onClick={() => router.push("/promises")}>View my promises</Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-8">
      <h1 className="text-2xl font-bold text-on-surface">Create a promise</h1>
      <p className="mt-1 text-sm text-on-surface-variant">Stake GEN behind a measurable, evidence-backed commitment.</p>

      <ol className="my-8 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <div
              className={clsx(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                i < stepIdx
                  ? "bg-secondary text-on-secondary"
                  : i === stepIdx
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-high text-on-surface-variant",
              )}
            >
              {i < stepIdx ? "✓" : i + 1}
            </div>
            <span className={clsx("hidden text-xs font-medium sm:block", i === stepIdx ? "text-on-surface" : "text-on-surface-variant")}>
              {s}
            </span>
            {i < STEPS.length - 1 ? <div className="h-px flex-1 bg-outline-variant" /> : null}
          </li>
        ))}
      </ol>

      <Card className="p-6">
        {step === "Statement" && (
          <div className="flex flex-col gap-5">
            <Field label="Title" htmlFor="title" hint="A short label for this promise.">
              <input id="title" className={inputClasses} value={form.title} maxLength={160} onChange={(e) => update({ title: e.target.value })} placeholder="Battery health above 90% on delivery" />
            </Field>
            <Field label="Statement" htmlFor="statement" hint="The human-readable promise, in one or two sentences.">
              <textarea id="statement" rows={2} className={inputClasses} maxLength={600} value={form.statement} onChange={(e) => update({ statement: e.target.value })} placeholder="The refurbished laptop's battery health will be at least 90% on delivery." />
            </Field>
            <Field label="Conditions" htmlFor="conditions" hint="Exact, measurable terms adjudication is run against. This is the core of the promise.">
              <textarea id="conditions" rows={5} className={inputClasses} maxLength={3000} value={form.conditions} onChange={(e) => update({ conditions: e.target.value })} placeholder="Battery health, as reported by the device's system diagnostics screenshot, must read >= 90%. A reading between 80-89% counts as partial fulfillment at a linearly scaled payout. Below 80% is broken." />
            </Field>
          </div>
        )}

        {step === "Subject" && (
          <div className="flex flex-col gap-5">
            <Field label="Counterparty address" htmlFor="counterparty" hint="The wallet address of the beneficiary who receives the stake if the promise is judged broken.">
              <input id="counterparty" className={inputClasses + " font-mono-data"} value={form.counterparty} onChange={(e) => update({ counterparty: e.target.value })} placeholder="0x..." />
            </Field>
            <Field label="Category" htmlFor="category" hint="A free-form tag for browsing and filtering.">
              <select id="category" className={inputClasses} value={form.category} onChange={(e) => update({ category: e.target.value })}>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {step === "Evidence" && (
          <div className="flex flex-col gap-5">
            <Field label="Evidence requirements" htmlFor="evidenceRequirements" hint="What the counterparty is expected to submit once the outcome is known.">
              <textarea id="evidenceRequirements" rows={5} className={inputClasses} maxLength={1500} value={form.evidenceRequirements} onChange={(e) => update({ evidenceRequirements: e.target.value })} placeholder="A screenshot of the device's battery health diagnostics screen, plus a photo of the device's serial number." />
            </Field>
          </div>
        )}

        {step === "Stake" && (
          <div className="flex flex-col gap-5">
            <Field label="Stake amount (GEN)" htmlFor="stakeGen" hint="Attached as native value with the create_promise transaction.">
              <input id="stakeGen" type="number" min="0" step="0.0001" className={inputClasses + " font-mono-data"} value={form.stakeGen} onChange={(e) => update({ stakeGen: e.target.value })} placeholder="10" />
            </Field>
            <Field label="Accept window" htmlFor="acceptWindow" hint="How long the counterparty has to accept before you can reclaim the stake.">
              <select id="acceptWindow" className={inputClasses} value={form.acceptWindowSeconds} onChange={(e) => update({ acceptWindowSeconds: Number(e.target.value) })}>
                {ACCEPT_WINDOW_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Evidence window" htmlFor="evidenceWindow" hint="How long the counterparty has, after accepting, to submit evidence.">
              <select id="evidenceWindow" className={inputClasses} value={form.evidenceWindowSeconds} onChange={(e) => update({ evidenceWindowSeconds: Number(e.target.value) })}>
                {EVIDENCE_WINDOW_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {step === "Review" && (
          <div className="flex flex-col gap-4">
            <ReviewRow label="Title" value={form.title} />
            <ReviewRow label="Statement" value={form.statement} />
            <ReviewRow label="Conditions" value={form.conditions} multiline />
            <ReviewRow label="Counterparty" value={form.counterparty} mono />
            <ReviewRow label="Category" value={form.category} />
            <ReviewRow label="Evidence requirements" value={form.evidenceRequirements} multiline />
            <ReviewRow label="Stake" value={`${form.stakeGen || "0"} GEN`} mono />
            <ReviewRow label="Accept window" value={durationLabel(form.acceptWindowSeconds)} />
            <ReviewRow label="Evidence window" value={durationLabel(form.evidenceWindowSeconds)} />
            <TxStatus state={state} error={error} txHash={txHash} />
          </div>
        )}
      </Card>

      <div className="mt-6 flex justify-between">
        <Button variant="outline" onClick={() => setStepIdx((i) => Math.max(0, i - 1))} disabled={stepIdx === 0 || state === "pending" || state === "confirming"}>
          Back
        </Button>
        {step === "Review" ? (
          <Button onClick={handleSubmit} disabled={state === "pending" || state === "confirming"}>
            {state === "pending" || state === "confirming" ? "Submitting…" : "Sign and create promise"}
          </Button>
        ) : (
          <Button onClick={() => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1))} disabled={!canProceed}>
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}

function ReviewRow({ label, value, mono, multiline }: { label: string; value: string; mono?: boolean; multiline?: boolean }) {
  return (
    <div className="border-b border-outline-variant pb-3 last:border-0">
      <p className="label-caps">{label}</p>
      <p className={clsx("mt-1 text-sm text-on-surface", mono && "font-mono-data", multiline && "whitespace-pre-wrap")}>
        {value || "—"}
      </p>
    </div>
  );
}
