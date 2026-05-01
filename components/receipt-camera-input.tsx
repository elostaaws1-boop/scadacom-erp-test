"use client";

import { Camera, Plus, RotateCcw, X } from "lucide-react";
import { useRef, useState } from "react";

type CapturedReceipt = {
  preview: string;
  cost: string;
  note: string;
  analyzing: boolean;
};

export function ReceiptCameraInput({ name = "receiptPhoto" }: { name?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [receipts, setReceipts] = useState<CapturedReceipt[]>([]);
  const [error, setError] = useState("");

  async function startCamera() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false
      });
      streamRef.current = stream;
      setActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setError("Camera access is required to take a receipt photo.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setActive(false);
  }

  async function capturePhoto() {
    const video = videoRef.current;
    const input = inputRef.current;
    if (!video || !input) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    if (!blob) return;

    const file = new File([blob], `receipt-${Date.now()}.jpg`, { type: "image/jpeg" });
    const preview = URL.createObjectURL(blob);
    const transfer = new DataTransfer();
    Array.from(input.files ?? []).forEach((existingFile) => transfer.items.add(existingFile));
    transfer.items.add(file);
    input.files = transfer.files;
    const receiptIndex = receipts.length;
    setReceipts((current) => [...current, { preview, cost: "", note: "", analyzing: true }]);
    stopCamera();
    await analyzeReceipt(file, receiptIndex);
  }

  async function analyzeReceipt(file: File, index: number) {
    try {
      const formData = new FormData();
      formData.append("receipt", file);
      const response = await fetch("/api/receipts/analyze", { method: "POST", body: formData });
      if (!response.ok) throw new Error("Receipt analysis failed.");
      const data = (await response.json()) as { price?: string; product?: string };
      setReceipts((current) =>
        current.map((receipt, receiptIndex) =>
          receiptIndex === index
            ? {
                ...receipt,
                cost: data.price || receipt.cost,
                note: data.product || receipt.note,
                analyzing: false
              }
            : receipt
        )
      );
    } catch {
      setReceipts((current) => current.map((receipt, receiptIndex) => (receiptIndex === index ? { ...receipt, analyzing: false } : receipt)));
    }
  }

  function resetPhotos() {
    if (inputRef.current) inputRef.current.value = "";
    receipts.forEach((receipt) => URL.revokeObjectURL(receipt.preview));
    setReceipts([]);
  }

  function removePhoto(index: number) {
    const input = inputRef.current;
    if (!input) return;
    const transfer = new DataTransfer();
    Array.from(input.files ?? []).forEach((file, fileIndex) => {
      if (fileIndex !== index) transfer.items.add(file);
    });
    input.files = transfer.files;
    URL.revokeObjectURL(receipts[index].preview);
    setReceipts((current) => current.filter((_, receiptIndex) => receiptIndex !== index));
  }

  function updateReceipt(index: number, field: "cost" | "note", value: string) {
    setReceipts((current) => current.map((receipt, receiptIndex) => (receiptIndex === index ? { ...receipt, [field]: value } : receipt)));
  }

  return (
    <div className="rounded-md border border-dashed border-stone-300 bg-field p-3">
      <input ref={inputRef} name={name} type="file" accept="image/jpeg" multiple className="hidden" />
      <p className="text-sm font-semibold text-ink">Receipt photo</p>

      {receipts.length > 0 ? (
        <div className="mt-3">
          <div className="grid gap-3">
            {receipts.map((receipt, index) => (
              <div className="rounded-md border border-black/10 bg-white p-2" key={receipt.preview}>
                <div className="relative">
                  <img src={receipt.preview} alt={`Captured receipt ${index + 1}`} className="h-32 w-full rounded-md border border-black/10 object-cover" />
                  <button type="button" onClick={() => removePhoto(index)} className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-white text-ink shadow" title="Remove receipt photo">
                    <X size={15} />
                  </button>
                </div>
                <label className="mt-2 block text-xs font-semibold text-ink">
                  Receipt cost MAD
                  <input
                    name="receiptCosts"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={receipt.cost}
                    onChange={(event) => updateReceipt(index, "cost", event.target.value)}
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    placeholder={receipt.analyzing ? "Analyzing..." : "Required"}
                  />
                </label>
                <label className="mt-2 block text-xs font-semibold text-ink">
                  Product / receipt note
                  <input
                    name="receiptNotes"
                    value={receipt.note}
                    onChange={(event) => updateReceipt(index, "note", event.target.value)}
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    placeholder={receipt.analyzing ? "Reading product..." : "Optional"}
                  />
                </label>
                <p className="mt-2 text-xs text-stone-500">
                  {receipt.analyzing ? "Analyzing receipt image..." : "Review detected price and product before submitting."}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs font-medium text-stone-600">{receipts.length} receipt photo{receipts.length === 1 ? "" : "s"} captured. Cost is mandatory for each receipt. Note is optional.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={startCamera} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-mint px-3 py-3 text-sm font-semibold text-white">
              <Plus size={16} /> Add another receipt
            </button>
            <button type="button" onClick={resetPhotos} className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-black/10 bg-white px-3 py-3 text-sm font-semibold">
              <RotateCcw size={16} /> Clear all
            </button>
          </div>
        </div>
      ) : null}

      {active ? (
        <div className="mt-3">
          <video ref={videoRef} playsInline muted className="max-h-56 w-full rounded-md bg-black object-cover" />
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={capturePhoto} className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-mint px-3 py-2 text-sm font-semibold text-white">
              <Camera size={16} /> Capture
            </button>
            <button type="button" onClick={stopCamera} className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-black/10 bg-white" title="Cancel camera">
              <X size={16} />
            </button>
          </div>
        </div>
      ) : null}

      {!active && receipts.length === 0 ? (
        <button type="button" onClick={startCamera} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-ink px-3 py-3 text-sm font-semibold text-white">
          <Camera size={16} /> Take photo
        </button>
      ) : null}

      {error ? <p className="mt-2 text-xs font-medium text-red-700">{error}</p> : null}
    </div>
  );
}
