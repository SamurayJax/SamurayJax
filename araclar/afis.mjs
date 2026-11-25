// Tek parça profil afişi: başlık + tanıtım + projeler + istatistikler + hobiler (+ iletişim) → tek SVG.
// Dört çıktı: assets/profil-{koyu,acik}-{genis,dar}.svg  (geniş: iki sütun; dar: telefon, tek sütun)
// Kullanım:
//   GH_TOKEN=... GH_KULLANICI=<kullanıcı> node araclar/afis.mjs
//   node araclar/afis.mjs --ornek      (ağ yok; örnek istatistikle görünüm denemesi)
// Gizli depoları da saymak için GH_TOKEN, depolara okuma izni olan kişisel erişim jetonu (PROFIL_TOKEN) olmalı.
// İletişim satırı PROFIL_EPOSTA ortam değişkeninden okunur (repo ayarlarında Actions değişkeni); yoksa afişte iletişim bölümü olmaz.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORNEK = process.argv.includes("--ornek");
const KULLANICI = process.env.GH_KULLANICI || "SamurayJax";
const ILETISIM = (process.env.PROFIL_EPOSTA || "").trim();
const YAZI = "'Segoe UI','Helvetica Neue',Arial,sans-serif";

/* ---------- Gece Mürekkebi renkleri (EasyAnim teması) ---------- */
const TEMA = {
  koyu: { zemin1: "#0a0f22", zemin2: "#0d1430", kart1: "#121b40", kart2: "#0c122b", kenar: "rgba(231,234,242,.14)",
    baslik: "#e7eaf2", metin: "#a6b0c8", soluk: "#6f7a98", kirmizi: "#d63c42", altin: "#e2b466",
    etiket: "rgba(231,234,242,.07)", etiketKenar: "rgba(231,234,242,.18)", bos: "rgba(231,234,242,.08)" },
  acik: { zemin1: "#f4eee2", zemin2: "#efe7d6", kart1: "#fbf7ee", kart2: "#f1e9d8", kenar: "rgba(21,24,42,.14)",
    baslik: "#15182a", metin: "#4a4f63", soluk: "#8a8574", kirmizi: "#c8323a", altin: "#a8781e",
    etiket: "rgba(21,24,42,.05)", etiketKenar: "rgba(21,24,42,.16)", bos: "rgba(21,24,42,.07)" },
};
const DIL_RENK = { TypeScript: "#3178c6", JavaScript: "#f1e05a", Python: "#3572A5", "C#": "#178600", Java: "#b07219",
  HTML: "#e34c26", CSS: "#663399", Rust: "#dea584", Luau: "#00A2FF", Shell: "#89e051" };

const kacis = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function satirla(metin, enCok) {
  const out = []; let s = "";
  for (const k of metin.split(/\s+/)) { if ((s + " " + k).trim().length > enCok && s) { out.push(s); s = k; } else s = (s + " " + k).trim(); }
  if (s) out.push(s);
  return out;
}
/* Kısa fırça vurgusu: başta basan, sonda incelen darbe. */
function firca(x, y, uzunluk, kalinlik, renk) {
  const N = 24, ust = [], alt = [];
  for (let i = 0; i < N; i++) {
    const s = i / (N - 1), px = x + uzunluk * s, py = y - 2.5 * Math.sin(Math.PI * s);
    const r = Math.max(0.4, (kalinlik / 2) * (0.55 + 0.6 * Math.exp(-Math.pow(s / 0.12, 2))) * Math.pow(Math.sin(Math.min(1, (1 - s) / 0.35) * Math.PI / 2), 0.8));
    ust.push(`${px.toFixed(1)} ${(py - r).toFixed(1)}`); alt.push(`${px.toFixed(1)} ${(py + r).toFixed(1)}`);
  }
  return `<path d="M${ust.join(" L")} L${alt.reverse().join(" L")}Z" fill="${renk}"/>`;
}

/* ---------- başlık (EasyAnim fırçasıyla üretilmiş SVG, iç içe gömülür) ---------- */
function baslikIc(ad) {
  const s = fs.readFileSync(path.join(KOK, `assets/baslik-${ad}.svg`), "utf8");
  return s.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/<title>[\s\S]*?<\/title>/, "");
}

/* ---------- istatistik verisi ---------- */
const SORGU = `query($login: String!, $sonra: String) {
  user(login: $login) {
    contributionsCollection {
      totalCommitContributions restrictedContributionsCount
      contributionCalendar { totalContributions weeks { contributionDays { contributionCount } } }
    }
    repositories(ownerAffiliations: OWNER, isFork: false, first: 100, after: $sonra) {
      totalCount pageInfo { hasNextPage endCursor }
      nodes { isPrivate languages(first: 10, orderBy: {field: SIZE, direction: DESC}) { edges { size node { name color } } } }
    }
  }
}`;
async function veriTopla() {
  let sonra = null, ilk = null, depolar = [];
  do {
    const yanit = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { Authorization: `bearer ${process.env.GH_TOKEN}`, "Content-Type": "application/json", "User-Agent": "profil-afis" },
      body: JSON.stringify({ query: SORGU, variables: { login: KULLANICI, sonra } }),
    });
    const j = await yanit.json();
    if (!yanit.ok || j.errors) throw new Error("GitHub API hatası: " + JSON.stringify(j.errors || j).slice(0, 400));
    const u = j.data.user; ilk = ilk || u;
    depolar = depolar.concat(u.repositories.nodes);
    sonra = u.repositories.pageInfo.hasNextPage ? u.repositories.pageInfo.endCursor : null;
  } while (sonra);
  const c = ilk.contributionsCollection, diller = {};
  for (const d of depolar) for (const e of d.languages.edges) {
    diller[e.node.name] = diller[e.node.name] || { boyut: 0, renk: e.node.color || DIL_RENK[e.node.name] || "#888" };
    diller[e.node.name].boyut += e.size;
  }
  return { yillikKatki: c.contributionCalendar.totalContributions, commit: c.totalCommitContributions + c.restrictedContributionsCount,
    depo: ilk.repositories.totalCount, gizliDepo: depolar.filter(d => d.isPrivate).length,
    gunler: c.contributionCalendar.weeks.flatMap(w => w.contributionDays), diller };
}
function ornekVeri() {
  const gunler = Array.from({ length: 365 }, (_, i) => ({ contributionCount: i > 360 ? 2 : (i * 7) % 5 > 1 ? (i * 13) % 6 : 0 }));
  const d = { TypeScript: 590, JavaScript: 288, "C#": 210, Python: 180, Java: 41, HTML: 4 };
  return { yillikKatki: 838, commit: 812, depo: 21, gizliDepo: 14, gunler,
    diller: Object.fromEntries(Object.entries(d).map(([k, v]) => [k, { boyut: v, renk: DIL_RENK[k] }])) };
}
function seriler(gunler) {
  let enUzun = 0, sayac = 0, simdiki = 0;
  for (const g of gunler) { sayac = g.contributionCount > 0 ? sayac + 1 : 0; enUzun = Math.max(enUzun, sayac); }
  const ters = [...gunler].reverse();
  for (let i = ters[0] && ters[0].contributionCount === 0 ? 1 : 0; i < ters.length && ters[i].contributionCount > 0; i++) simdiki++;
  return { simdiki, enUzun };
}

/* ---------- parçalar ---------- */
function bolumBasligi(x, y, metin, T) {
  return `<text x="${x}" y="${y}" font-size="22" font-weight="700" fill="${T.baslik}">${kacis(metin)}</text>` + firca(x, y + 11, metin.length * 9 + 20, 5, T.kirmizi);
}
function kart(p, x, y, w, h, T) {
  const durumW = Math.round(p.durumYazi.length * 6.6 + 18);
  const durumRenk = p.durumYazi === "açık kaynak" ? T.altin : /planlama|geliştiriliyor/.test(p.durumYazi) ? T.kirmizi : T.soluk;
  const satirlar = satirla(p.aciklama, Math.floor((w - 40) / 7.3)).slice(0, 2);
  let ex = x + 20, etiket = "";
  for (const e of p.etiketler) {
    const ew = Math.round(e.length * 7 + 18);
    etiket += `<rect x="${ex}" y="${y + h - 36}" width="${ew}" height="22" rx="11" fill="${T.etiket}" stroke="${T.etiketKenar}"/>` +
      `<text x="${ex + ew / 2}" y="${y + h - 21}" text-anchor="middle" font-size="11.5" fill="${T.metin}">${kacis(e)}</text>`;
    ex += ew + 6;
  }
  return `<rect x="${x + .5}" y="${y + .5}" width="${w - 1}" height="${h - 1}" rx="12" fill="url(#p-kart)" stroke="${T.kenar}"/>` +
    `<text x="${x + 20}" y="${y + 34}" font-size="18" font-weight="600" fill="${T.baslik}">${kacis(p.emoji + " " + p.ad)}</text>` +
    firca(x + 20, y + 46, Math.min(150, p.ad.length * 10 + 24), 4.5, T.kirmizi) +
    `<rect x="${x + w - durumW - 14}" y="${y + 17}" width="${durumW}" height="22" rx="11" fill="none" stroke="${durumRenk}"/>` +
    `<text x="${x + w - durumW / 2 - 14}" y="${y + 32}" text-anchor="middle" font-size="11.5" fill="${durumRenk}">${kacis(p.durumYazi)}</text>` +
    satirlar.map((s, i) => `<text x="${x + 20}" y="${y + 72 + i * 19}" font-size="13.5" fill="${T.metin}">${kacis(s)}</text>`).join("") + etiket;
}
function istatistik(v, x, y, w, T, dar) {
  const { simdiki, enUzun } = seriler(v.gunler);
  const sayilar = [["Son 1 yıl katkı", String(v.yillikKatki), ""], ["Bu yıl commit", String(v.commit), ""],
    ["Depo", String(v.depo), v.gizliDepo ? `${v.gizliDepo} gizli` : ""], ["Kesintisiz seri", `${simdiki} gün`, `en uzun ${enUzun}`]];
  const toplam = Object.values(v.diller).reduce((a, d) => a + d.boyut, 0) || 1;
  const enCok = Object.entries(v.diller).sort((a, b) => b[1].boyut - a[1].boyut).slice(0, 6);
  let out = "";
  const sutunW = dar ? (w - 40) / 2 : 190;
  sayilar.forEach(([etiket, deger, alt], i) => {
    const sx = x + 24 + (i % 2) * sutunW, sy = y + 52 + Math.floor(i / 2) * 84;
    out += `<text x="${sx}" y="${sy}" font-size="32" font-weight="600" fill="${T.baslik}">${kacis(deger)}</text>` + firca(sx, sy + 11, 44, 4, T.kirmizi) +
      `<text x="${sx}" y="${sy + 32}" font-size="12.5" fill="${T.metin}">${kacis(etiket)}${alt ? `  ·  ${kacis(alt)}` : ""}</text>`;
  });
  const gx = dar ? x + 24 : x + 430, gy = dar ? y + 222 : y + 34, kareW = dar ? Math.min(13.6, (w - 48) / 26) : 13.6;
  const son = v.gunler.slice(-182), tepe = Math.max(1, ...son.map(g => g.contributionCount));
  out += `<text x="${gx}" y="${gy - 10}" font-size="12" fill="${T.soluk}">Son 26 hafta</text>`;
  son.forEach((g, i) => {
    const o = g.contributionCount ? 0.25 + 0.75 * g.contributionCount / tepe : 0;
    out += `<rect x="${(gx + Math.floor(i / 7) * kareW).toFixed(1)}" y="${(gy + (i % 7) * kareW).toFixed(1)}" width="${(kareW - 2.6).toFixed(1)}" height="${(kareW - 2.6).toFixed(1)}" rx="2.4" fill="${o ? T.kirmizi : T.bos}"${o ? ` fill-opacity="${o.toFixed(2)}"` : ""}/>`;
  });
  const dy = gy + 7 * kareW + 28, cw = dar ? w - 48 : w - 430 - 24, kimlik = dar ? "p-dil-d" : "p-dil-g";
  out += `<text x="${gx}" y="${dy}" font-size="12" fill="${T.soluk}">En çok kullanılan diller</text>`;
  out += `<clipPath id="${kimlik}"><rect x="${gx}" y="${dy + 9}" width="${cw}" height="10" rx="5"/></clipPath><rect x="${gx}" y="${dy + 9}" width="${cw}" height="10" rx="5" fill="${T.bos}"/><g clip-path="url(#${kimlik})">`;
  let cx = gx;
  for (const [, d] of enCok) { const bw = Math.max(2, d.boyut / toplam * cw); out += `<rect x="${cx.toFixed(1)}" y="${dy + 9}" width="${bw.toFixed(1)}" height="10" fill="${d.renk}"/>`; cx += bw; }
  out += "</g>";
  const kol = dar ? 2 : 3, kolW = cw / kol;
  enCok.forEach(([ad, d], i) => {
    const lx = gx + (i % kol) * kolW, ly = dy + 42 + Math.floor(i / kol) * 21;
    out += `<circle cx="${lx + 5}" cy="${ly - 4}" r="5" fill="${d.renk}"/><text x="${lx + 15}" y="${ly}" font-size="12.5" fill="${T.metin}">${kacis(ad)} %${(d.boyut / toplam * 100).toFixed(1)}</text>`;
  });
  let h = dy + 42 + Math.ceil(enCok.length / kol) * 21 - y + 10;
  if (!dar) h = Math.max(h, 210);
  const tarih = ORNEK ? "örnek veri" : "güncelleme " + new Date().toISOString().slice(0, 10);
  out += `<text x="${x + 24}" y="${y + h - 4}" font-size="10.5" fill="${T.soluk}">${tarih} · her gün kendiliğinden yenilenir</text>`;
  return { svg: `<rect x="${x + .5}" y="${y + .5}" width="${w - 1}" height="${h + 14}" rx="14" fill="url(#p-kart)" stroke="${T.kenar}"/>` + out, h: h + 14 };
}

/* ---------- afiş ---------- */
function afis(ad, dar, v, projeler) {
  const T = TEMA[ad], W = dar ? 480 : 900, P = dar ? 16 : 24, ic = W - 2 * P;
  const bH = Math.round(W * 340 / 1200);
  let y = bH + (dar ? 26 : 34), govde = "";
  govde += `<text x="${P}" y="${y}" font-size="${dar ? 21 : 24}" font-weight="700" fill="${T.baslik}">Merhaba, ben SamurayJax 👋</text>`;
  y += dar ? 28 : 32;
  const tanitim = "İhtiyacım olan aracı bulamayınca kendim yapıyorum: animasyon motorları, masaüstü uygulamaları, oyun araçları. Her projede yapay zekâyla birlikte çalışıyorum; yavaş yavaş ama doğru şekilde.";
  for (const s of satirla(tanitim, dar ? 54 : 104)) { govde += `<text x="${P}" y="${y}" font-size="${dar ? 14.5 : 15.5}" fill="${T.metin}">${kacis(s)}</text>`; y += dar ? 21 : 23; }
  y += dar ? 26 : 30;
  govde += bolumBasligi(P, y, "⚔️ Projeler", T); y += 30;
  const kW = dar ? ic : (ic - 16) / 2, kH = 142;
  projeler.forEach((p, i) => {
    const kx = dar ? P : P + (i % 2) * (kW + 16), ky = y + (dar ? i : Math.floor(i / 2)) * (kH + 14);
    govde += kart(p, kx, ky, kW, kH, T);
  });
  y += (dar ? projeler.length : Math.ceil(projeler.length / 2)) * (kH + 14) - 4;
  govde += `<text x="${P}" y="${y + 12}" font-size="12" fill="${T.soluk}">🔒 Çoğu projenin kodu şimdilik özel depoda.</text>`;
  y += dar ? 50 : 54;
  govde += bolumBasligi(P, y, "📊 İstatistikler", T); y += 30;
  const ist = istatistik(v, P, y, ic, T, dar); govde += ist.svg; y += ist.h;
  y += dar ? 46 : 50;
  govde += bolumBasligi(P, y, "🎲 Boş zamanlarımda", T); y += 40;
  for (const s of satirla("DnD oturumlarında DM'lik yapıyorum · kart sihri çalışıyorum · okumayı seviyorum.", dar ? 54 : 104)) {
    govde += `<text x="${P}" y="${y}" font-size="15" fill="${T.metin}">${kacis(s)}</text>`; y += 22;
  }
  if (ILETISIM) {
    y += dar ? 30 : 32;
    govde += bolumBasligi(P, y, "📫 İletişim", T); y += 40;
    govde += `<text x="${P}" y="${y}" font-size="15" fill="${T.metin}">✉️ ${kacis(ILETISIM)}</text>`;
  }
  y += 34;
  govde += `<line x1="${P}" y1="${y}" x2="${W - P}" y2="${y}" stroke="${T.kenar}"/>`;
  y += 22;
  for (const s of satirla("Başlık, kendi animasyon motorum EasyAnim'in fırçasıyla çizildi. İstatistikler her gün GitHub Actions ile kendiliğinden yenilenir.", dar ? 70 : 140)) {
    govde += `<text x="${P}" y="${y}" font-size="11.5" fill="${T.soluk}">${kacis(s)}</text>`; y += 16;
  }
  const H = y + 14;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="SamurayJax — profil">
<title>SamurayJax</title>
<defs>
<linearGradient id="p-zemin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.zemin1}"/><stop offset="1" stop-color="${T.zemin2}"/></linearGradient>
<linearGradient id="p-kart" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${T.kart1}"/><stop offset="1" stop-color="${T.kart2}"/></linearGradient>
<clipPath id="p-kose"><rect width="${W}" height="${H}" rx="16"/></clipPath>
</defs>
<g clip-path="url(#p-kose)">
<rect width="${W}" height="${H}" fill="url(#p-zemin)"/>
<svg x="0" y="0" width="${W}" height="${bH}" viewBox="0 0 1200 340">${baslikIc(ad)}</svg>
<g font-family="${YAZI}">${govde}</g>
</g>
</svg>
`;
}

const projeler = JSON.parse(fs.readFileSync(path.join(KOK, "araclar/projeler.json"), "utf8"))
  .flatMap(g => g.projeler).map(p => ({ ...p, durumYazi: p.durum.replace(/^\S+\s/, "") }));
const veri = ORNEK ? ornekVeri() : await veriTopla();
for (const ad of ["koyu", "acik"]) for (const dar of [false, true]) {
  fs.writeFileSync(path.join(KOK, `assets/profil-${ad}-${dar ? "dar" : "genis"}.svg`), afis(ad, dar, veri, projeler));
}
console.log("afişler yazıldı", ORNEK ? "(örnek veri)" : "", ILETISIM ? "" : "(iletişim değişkeni yok, iletişim bölümü atlandı)");
