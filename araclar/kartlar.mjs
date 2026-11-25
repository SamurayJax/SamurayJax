// Proje kartları: araclar/projeler.json → assets/kart-<id>-{koyu,acik}.svg
// Kullanım: node araclar/kartlar.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TEMA, YAZI, kacis, satirla, fircaVurgu } from "./tema.mjs";

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projeler = JSON.parse(fs.readFileSync(path.join(KOK, "araclar/projeler.json"), "utf8"));
const W = 420, H = 148;

function etiketler(liste, T, x0, y) {
  let x = x0, out = "";
  for (const e of liste) {
    const w = Math.round(e.length * 7 + 18);
    out += `<rect x="${x}" y="${y}" width="${w}" height="22" rx="11" fill="${T.etiket}" stroke="${T.etiketKenar}"/>` +
           `<text x="${x + w / 2}" y="${y + 15}" text-anchor="middle" font-size="11.5" fill="${T.metin}">${kacis(e)}</text>`;
    x += w + 6;
  }
  return out;
}

function kart(p, ad) {
  const T = TEMA[ad];
  const satirlar = satirla(p.aciklama, 50).slice(0, 2);
  const durumW = Math.round(p.durum.length * 6.6 + 18);
  const durumRenk = p.durum === "açık kaynak" ? T.altin : p.durum === "planlama" || p.durum === "geliştiriliyor" ? T.kirmizi : T.soluk;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${kacis(p.ad)}: ${kacis(p.aciklama)}">
<title>${kacis(p.ad)}</title>
<defs><linearGradient id="z" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${T.zemin1}"/><stop offset="1" stop-color="${T.zemin2}"/></linearGradient></defs>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="12" fill="url(#z)" stroke="${T.kenar}"/>
<g font-family="${YAZI}">
<text x="22" y="38" font-size="19" font-weight="600" fill="${T.baslik}">${kacis(p.ad)}</text>
${fircaVurgu(22, 50, Math.min(150, p.ad.length * 10.5), 5, T.kirmizi)}
<rect x="${W - durumW - 16}" y="20" width="${durumW}" height="22" rx="11" fill="none" stroke="${durumRenk}"/>
<text x="${W - durumW / 2 - 16}" y="35" text-anchor="middle" font-size="11.5" fill="${durumRenk}">${kacis(p.durum)}</text>
${satirlar.map((s, i) => `<text x="22" y="${76 + i * 19}" font-size="13.5" fill="${T.metin}">${kacis(s)}</text>`).join("")}
${etiketler(p.etiketler, T, 22, 112)}
</g>
</svg>
`;
}

for (const p of projeler) for (const ad of ["koyu", "acik"]) {
  fs.writeFileSync(path.join(KOK, `assets/kart-${p.id}-${ad}.svg`), kart(p, ad));
}
console.log(`${projeler.length} proje × 2 tema kart yazıldı`);
