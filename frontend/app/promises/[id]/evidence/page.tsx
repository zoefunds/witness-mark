"use client";

import { use, useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePromise } from "@/hooks/usePromiseData";
import { useWallet } from "@/hooks/useWallet";
import { useAuth } from "@/hooks/useAuth";
import { useContractTx } from "@/hooks/useContractTx";
import { submitEvidence } from "@/lib/genlayer";
import { api, ApiError } from "@/lib/api";
import { Button, Card, CardHeader, EmptyState, ErrorState, Field, Spinner, inputClasses } from "@/components/ui";
import { TxStatus } from "@/components/TxStatus";
import { formatTs, truncateAddress } from "@/lib/format";

export default function EvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const promiseId = Number(id);
  const { data: promise, isLoading, isError } = usePromise(promiseId);
  const { address, isConnected, connect, contractConfigured } = useWallet();
  const { isAuthenticated, checked: authChecked, signingIn, error: authError, signIn } = useAuth();
  const { run, state, error, txHash, reset } = useContractTx();
  const queryClient = useQueryClient();

  const [urls, setUrls] = useState<string[]>([""]);
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateUrl = (i: number, value: string) => setUrls((u) => u.map((existing, idx) => (idx === i ? value : existing)));
  const addUrlField = () => setUrls((u) => (u.length >= 8 ? u : [...u, ""]));
  const removeUrlField = (i: number) => setUrls((u) => u.filter((_, idx) => idx !== i));

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    if (!isAuthenticated) {
      const ok = await signIn();
      if (!ok) {
        setUploadError("File upload requires signing in with your wallet first.");
        return;
      }
    }
    setUploading(true);
    try {
      const results = await api.evidence.upload(Array.from(files), promiseId);
      const succeeded = results.filter((r): r is { url: string; filename: string; bytes: number } => "url" in r);
      const failed = results.filter((r): r is { error: string; filename: string } => "error" in r);
      if (succeeded.length > 0) {
        setUrls((u) => {
          const withoutEmpty = u.filter((x) => x.trim() !== "");
          return [...withoutEmpty, ...succeeded.map((r) => r.url)];
        });
      }
      if (failed.length > 0) {
        setUploadError(failed.map((f) => `${f.filename}: ${f.error}`).join("; "));
      }
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }, [promiseId, isAuthenticated, signIn]);

  if (!contractConfigured) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
        <EmptyState title="Contract not configured" description="Set NEXT_PUBLIC_CONTRACT_ADDRESS to submit evidence." />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
        <div className="flex items-center gap-2 text-on-surface-variant"><Spinner className="h-5 w-5" /> Loading…</div>
      </div>
    );
  }

  if (isError || !promise) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
        <ErrorState title={`Could not load promise #${id}`} />
      </div>
    );
  }

  const isCounterparty = address && promise.counterparty.toLowerCase() === address.toLowerCase();
  const canSubmit = ["ACCEPTED", "EVIDENCE_SUBMITTED", "UNDETERMINED"].includes(promise.status);
  const validUrls = urls.map((u) => u.trim()).filter(Boolean);

  async function handleSubmit() {
    const result = await run((args) => submitEvidence(args, promiseId, validUrls, note.trim()));
    if (result !== null) {
      queryClient.invalidateQueries({ queryKey: ["promise", promiseId] });
      queryClient.invalidateQueries({ queryKey: ["activity", promiseId] });
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
      <p className="font-mono-data text-xs text-on-surface-variant">Promise #{promise.id}</p>
      <h1 className="mt-1 text-2xl font-bold text-on-surface">Submit evidence</h1>
      <p className="mt-1 text-sm text-on-surface-variant">{promise.title}</p>

      <Card className="my-6">
        <CardHeader title="Required" />
        <p className="whitespace-pre-wrap p-5 text-sm text-on-surface">{promise.evidence_requirements || "No specific requirements were listed — submit whatever documents the promise's conditions."}</p>
      </Card>

      {promise.evidence_urls.length > 0 ? (
        <Card className="mb-6">
          <CardHeader title="Already submitted" meta={promise.evidence_submitted_ts ? formatTs(promise.evidence_submitted_ts) : undefined} />
          <ul className="flex flex-col gap-2 p-5">
            {promise.evidence_urls.map((url, i) => (
              <li key={i} className="break-all font-mono-data text-xs text-on-surface-variant">{url}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      {!isConnected ? (
        <EmptyState title="Connect your wallet" action={<Button onClick={connect}>Connect wallet</Button>} />
      ) : !isCounterparty ? (
        <EmptyState title="Only the counterparty can submit evidence" description={`This promise's counterparty is ${truncateAddress(promise.counterparty)}.`} />
      ) : !canSubmit ? (
        <EmptyState title="Evidence submission isn't open" description={`This promise is currently ${promise.status}.`} />
      ) : (
        <Card className="flex flex-col gap-5 p-6">
          <div>
            <p className="label-caps mb-2">Evidence URLs</p>
            <div className="flex flex-col gap-2">
              {urls.map((u, i) => (
                <div key={i} className="flex gap-2">
                  <input className={inputClasses} value={u} onChange={(e) => updateUrl(i, e.target.value)} placeholder="https://..." />
                  {urls.length > 1 ? (
                    <button type="button" onClick={() => removeUrlField(i)} className="focus-ring rounded-md border border-outline-variant px-3 text-sm text-on-surface-variant hover:bg-surface-container">
                      Remove
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            <button type="button" onClick={addUrlField} className="mt-2 text-xs font-medium text-primary underline">
              + Add another URL
            </button>
          </div>

          <div>
            <p className="label-caps mb-2">Or upload files</p>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${dragActive ? "border-primary bg-surface-container-low" : "border-outline-variant"}`}
            >
              <p className="text-sm font-medium text-on-surface">Drag and drop files, or click to browse</p>
              <p className="text-xs text-on-surface-variant">Uploaded to WitnessMark storage; the resulting URL is added above.</p>
              {authChecked && !isAuthenticated ? (
                <p className="text-xs text-on-surface-variant">
                  Uploading a file will first ask you to sign a free (gasless) message to verify your wallet.
                </p>
              ) : null}
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
            </div>
            {signingIn ? <p className="mt-2 flex items-center gap-2 text-xs text-on-surface-variant"><Spinner className="h-3.5 w-3.5" /> Waiting for wallet signature…</p> : null}
            {uploading ? <p className="mt-2 flex items-center gap-2 text-xs text-on-surface-variant"><Spinner className="h-3.5 w-3.5" /> Uploading…</p> : null}
            {uploadError ? <p className="mt-2 text-xs text-error">{uploadError}</p> : null}
            {authError && !uploadError ? <p className="mt-2 text-xs text-error">{authError}</p> : null}
          </div>

          <Field label="Note (optional)" htmlFor="note" hint="Any additional context for the adjudicator.">
            <textarea id="note" rows={3} maxLength={1000} className={inputClasses} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>

          <TxStatus state={state} error={error} txHash={txHash} />

          <div className="flex justify-end gap-3">
            {state === "confirmed" ? (
              <Button variant="outline" onClick={reset}>Submit more</Button>
            ) : (
              <Button onClick={handleSubmit} disabled={validUrls.length === 0 || state === "pending" || state === "confirming"}>
                {state === "pending" || state === "confirming" ? "Submitting…" : "Submit evidence"}
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
