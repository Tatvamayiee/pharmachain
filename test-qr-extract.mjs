// Test the extractQrId logic exactly as in QRChecking.tsx
function extractQrId(input) {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/(?:verify|track)\/([A-Za-z0-9-]+)/i);
  if (urlMatch) return urlMatch[1];
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed.qrId) return parsed.qrId;
    if (parsed.url) {
      const m = parsed.url.match(/(?:verify|track)\/([A-Za-z0-9-]+)/i);
      if (m) return m[1];
    }
  } catch {}
  if (/^MED-[\w-]+$/i.test(trimmed)) return trimmed;
  return '';
}

const inputs = [
  'MED-1RI0M297MSBEM679',
  'http://localhost:41837/verify/MED-1RI0M297MSBEM679',
  'http://localhost:5173/verify/MED-1RI0M297MSBEM679',
  'http://localhost:41837/track/SHIP-MSBEP1D3LXUA66',
  'verify/MED-1RI0M297MSBEM679',
  '{"qrId":"MED-ABC123"}',
  'MED-ABC123\n',
  'med-abc123',
];

for (const inp of inputs) {
  console.log(JSON.stringify(inp), '=>', JSON.stringify(extractQrId(inp)));
}

