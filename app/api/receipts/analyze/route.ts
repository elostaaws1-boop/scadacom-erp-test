import { recognize } from "tesseract.js";
import { auth } from "@/auth";

export const runtime = "nodejs";

const totalWords = ["total", "totale", "montant", "net", "payer", "payé", "ttc", "mad", "dh", "dhs"];
const ignoredProductWords = [
  "total",
  "subtotal",
  "sous total",
  "tva",
  "tax",
  "date",
  "heure",
  "ticket",
  "facture",
  "recu",
  "reçu",
  "merci",
  "client",
  "cash",
  "carte",
  "monnaie",
  "change"
];

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("receipt");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Receipt image is required." }, { status: 400 });
  }

  const image = Buffer.from(await file.arrayBuffer());
  const result = await recognize(image, "eng+fra");
  const rawText = result.data.text;
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const price = extractPrice(lines);
  const product = extractProduct(lines);

  return Response.json({ price, product });
}

function extractPrice(lines: string[]) {
  const amounts = lines.flatMap((line) => {
    const matches = line.match(/\b\d{1,5}(?:[,.]\d{2})\b/g) ?? [];
    return matches.map((match) => {
      const value = Number(match.replace(",", "."));
      const lower = line.toLowerCase();
      const score = totalWords.some((word) => lower.includes(word)) ? 2 : 1;
      return { value, score };
    });
  });

  if (amounts.length === 0) return "";
  const prioritized = amounts.sort((a, b) => b.score - a.score || b.value - a.value)[0];
  return prioritized.value.toFixed(2);
}

function extractProduct(lines: string[]) {
  const candidates = lines
    .map((line) => line.replace(/\b\d{1,5}(?:[,.]\d{2})\b/g, "").trim())
    .filter((line) => line.length >= 3)
    .filter((line) => /[a-zA-ZÀ-ÿ]/.test(line))
    .filter((line) => !ignoredProductWords.some((word) => line.toLowerCase().includes(word)))
    .filter((line) => !/^\d+[\s:/.-]*\d*/.test(line));

  return candidates.slice(0, 3).join(" / ");
}
