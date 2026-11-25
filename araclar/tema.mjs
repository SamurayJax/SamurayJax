// Gece Mürekkebi teması (EasyAnim) — profil kartları ve istatistikler için ortak renkler ve yardımcılar.
export const TEMA = {
  koyu: {
    zemin1: "#10183a", zemin2: "#0a0f22", kenar: "rgba(231,234,242,.16)", baslik: "#e7eaf2",
    metin: "#a6b0c8", soluk: "#6f7a98", kirmizi: "#d63c42", altin: "#e2b466",
    etiket: "rgba(231,234,242,.08)", etiketKenar: "rgba(231,234,242,.18)", cubukZemin: "rgba(231,234,242,.10)",
  },
  acik: {
    zemin1: "#f4eee2", zemin2: "#ebe2cf", kenar: "rgba(21,24,42,.16)", baslik: "#15182a",
    metin: "#4a4f63", soluk: "#8a8574", kirmizi: "#c8323a", altin: "#a8781e",
    etiket: "rgba(21,24,42,.05)", etiketKenar: "rgba(21,24,42,.16)", cubukZemin: "rgba(21,24,42,.08)",
  },
};

export const YAZI = "'Segoe UI','Helvetica Neue',Arial,sans-serif";

export function kacis(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* Kaba satır kırma: karakter sayısına göre (SVG metni kendiliğinden kaydırmaz). */
export function satirla(metin, enCok) {
  const kelimeler = metin.split(/\s+/), satirlar = [];
  let s = "";
  for (const k of kelimeler) {
    if ((s + " " + k).trim().length > enCok && s) { satirlar.push(s); s = k; } else s = (s + " " + k).trim();
  }
  if (s) satirlar.push(s);
  return satirlar;
}

/* Kısa fırça darbesi: başta basan, sonda incelen kırmızı vurgu (EasyAnim fırça fikrinin küçük, bağımsız bir sürümü). */
export function fircaVurgu(x, y, uzunluk, kalinlik, renk) {
  const N = 24, ust = [], alt = [];
  for (let i = 0; i < N; i++) {
    const s = i / (N - 1), px = x + uzunluk * s, py = y - 2.5 * Math.sin(Math.PI * s);
    const r = (kalinlik / 2) * (0.55 + 0.6 * Math.exp(-Math.pow(s / 0.12, 2))) * Math.pow(Math.sin(Math.min(1, (1 - s) / 0.35) * Math.PI / 2), 0.8);
    ust.push(`${px.toFixed(1)} ${(py - Math.max(r, 0.4)).toFixed(1)}`);
    alt.push(`${px.toFixed(1)} ${(py + Math.max(r, 0.4)).toFixed(1)}`);
  }
  return `<path d="M${ust.join(" L")} L${alt.reverse().join(" L")}Z" fill="${renk}"/>`;
}
