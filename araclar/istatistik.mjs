// GitHub istatistik kartı: GraphQL API → assets/istatistik-{koyu,acik}.svg
// Kullanım:
//   GH_TOKEN=... GH_KULLANICI=SamurayJax node araclar/istatistik.mjs
//   node araclar/istatistik.mjs --ornek      (ağ yok; örnek veriyle görünüm denemesi)
// Gizli depoları da saymak için GH_TOKEN, depolara okuma izni olan kişisel erişim jetonu (PROFIL_TOKEN) olmalı.
// Yalnız GITHUB_TOKEN ile çalışırsa gizli depoların dilleri sayılmaz; gizli katkılar ise profil ayarında
// "Private contributions" açıksa takvime toplam sayı olarak girer.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TEMA, YAZI, kacis, fircaVurgu } from "./tema.mjs";

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORNEK = process.argv.includes("--ornek");
const KULLANICI = process.env.GH_KULLANICI || "SamurayJax";

const SORGU = `query($login: String!, $sonra: String) {
  user(login: $login) {
    contributionsCollection {
      totalCommitContributions
      restrictedContributionsCount
      contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }
    }
    repositories(ownerAffiliations: OWNER, isFork: false, first: 100, after: $sonra) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes { isPrivate languages(first: 10, orderBy: {field: SIZE, direction: DESC}) { edges { size node { name color } } } }
    }
  }
}`;

async function graphql(degiskenler) {
  const yanit = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${process.env.GH_TOKEN}`, "Content-Type": "application/json", "User-Agent": "profil-istatistik" },
    body: JSON.stringify({ query: SORGU, variables: degiskenler }),
  });
  const j = await yanit.json();
  if (!yanit.ok || j.errors) throw new Error("GitHub API hatası: " + JSON.stringify(j.errors || j).slice(0, 400));
  return j.data.user;
}

async function veriTopla() {
  let sonra = null, ilk = null, depolar = [];
  do {
    const u = await graphql({ login: KULLANICI, sonra });
    ilk = ilk || u;
    depolar = depolar.concat(u.repositories.nodes);
    sonra = u.repositories.pageInfo.hasNextPage ? u.repositories.pageInfo.endCursor : null;
  } while (sonra);
  const c = ilk.contributionsCollection;
  const gunler = c.contributionCalendar.weeks.flatMap(w => w.contributionDays);
  const diller = {};
  for (const d of depolar) for (const e of d.languages.edges) {
    diller[e.node.name] = diller[e.node.name] || { boyut: 0, renk: e.node.color || "#888" };
    diller[e.node.name].boyut += e.size;
  }
  return {
    yillikKatki: c.contributionCalendar.totalContributions,
    commit: c.totalCommitContributions + c.restrictedContributionsCount,
    depo: ilk.repositories.totalCount,
    gizliDepo: depolar.filter(d => d.isPrivate).length,
    gunler, diller,
  };
}

function ornekVeri() {
  const gunler = [], bugun = new Date("2026-11-25");
  for (let i = 364; i >= 0; i--) {
    const d = new Date(bugun); d.setDate(d.getDate() - i);
    const n = i < 30 ? (i % 5 === 3 ? 0 : 3 + (i * 7) % 9) : (i % 3 === 0 ? 0 : (i * 13) % 6);
    gunler.push({ date: d.toISOString().slice(0, 10), contributionCount: n });
  }
  return {
    yillikKatki: gunler.reduce((a, g) => a + g.contributionCount, 0), commit: 812, depo: 21, gizliDepo: 14, gunler,
    diller: { JavaScript: { boyut: 900, renk: "#f1e05a" }, "C#": { boyut: 520, renk: "#178600" }, Python: { boyut: 430, renk: "#3572A5" },
      TypeScript: { boyut: 260, renk: "#3178c6" }, Java: { boyut: 140, renk: "#b07219" }, HTML: { boyut: 90, renk: "#e34c26" }, Rust: { boyut: 40, renk: "#dea584" } },
  };
}

function seriler(gunler) {
  let simdiki = 0, enUzun = 0, sayac = 0;
  for (const g of gunler) { sayac = g.contributionCount > 0 ? sayac + 1 : 0; enUzun = Math.max(enUzun, sayac); }
  /* Bugün henüz katkı yoksa seri dünden sayılır. */
  const ters = [...gunler].reverse();
  let i = ters[0] && ters[0].contributionCount === 0 ? 1 : 0;
  for (; i < ters.length && ters[i].contributionCount > 0; i++) simdiki++;
  return { simdiki, enUzun };
}

function kart(v, ad) {
  const T = TEMA[ad], W = 860, H = 230;
  const { simdiki, enUzun } = seriler(v.gunler);
  const sayilar = [
    ["Son 1 yıl katkı", v.yillikKatki],
    ["Bu yıl commit", v.commit],
    ["Depo", v.gizliDepo ? `${v.depo}` : v.depo, v.gizliDepo ? `${v.gizliDepo} gizli` : ""],
    ["Kesintisiz seri", `${simdiki} gün`, `en uzun ${enUzun}`],
  ];
  const toplam = Object.values(v.diller).reduce((a, d) => a + d.boyut, 0) || 1;
  const enCok = Object.entries(v.diller).sort((a, b) => b[1].boyut - a[1].boyut).slice(0, 6);
  /* Son 26 haftanın katkı şeridi */
  const son = v.gunler.slice(-182), tepe = Math.max(1, ...son.map(g => g.contributionCount));
  const kare = son.map((g, i) => {
    const x = 470 + Math.floor(i / 7) * 13.6, y = 36 + (i % 7) * 13.2, o = g.contributionCount ? 0.25 + 0.75 * g.contributionCount / tepe : 0;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="11" height="11" rx="2.5" fill="${o ? T.kirmizi : T.cubukZemin}"${o ? ` fill-opacity="${o.toFixed(2)}"` : ""}/>`;
  }).join("");
  let dilX = 470;
  const cubuk = enCok.map(([ad2, d]) => {
    const w = Math.max(2, (d.boyut / toplam) * 360), r = `<rect x="${dilX.toFixed(1)}" y="162" width="${w.toFixed(1)}" height="10" fill="${d.renk}"/>`;
    dilX += w; return r;
  }).join("");
  const dilEtiket = enCok.map(([ad2, d], i) => {
    const x = 470 + (i % 3) * 122, y = 194 + Math.floor(i / 3) * 21;
    return `<circle cx="${x + 5}" cy="${y - 4}" r="5" fill="${d.renk}"/><text x="${x + 15}" y="${y}" font-size="12.5" fill="${T.metin}">${kacis(ad2)} %${(d.boyut / toplam * 100).toFixed(1)}</text>`;
  }).join("");
  const tarih = new Date().toISOString().slice(0, 10);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="GitHub istatistikleri">
<title>GitHub istatistikleri</title>
<defs><linearGradient id="z" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${T.zemin1}"/><stop offset="1" stop-color="${T.zemin2}"/></linearGradient>
<clipPath id="kirp"><rect x="470" y="162" width="360" height="10" rx="5"/></clipPath></defs>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="url(#z)" stroke="${T.kenar}"/>
<g font-family="${YAZI}">
${sayilar.map(([etiket, deger, alt], i) => {
    const x = 30 + (i % 2) * 210, y = 64 + Math.floor(i / 2) * 92;
    return `<text x="${x}" y="${y}" font-size="34" font-weight="600" fill="${T.baslik}">${kacis(deger)}</text>` +
      fircaVurgu(x, y + 12, 46, 4, T.kirmizi) +
      `<text x="${x}" y="${y + 34}" font-size="13" fill="${T.metin}">${kacis(etiket)}</text>` +
      (alt ? `<text x="${x + 120}" y="${y}" font-size="12" fill="${T.soluk}">${kacis(alt)}</text>` : "");
  }).join("\n")}
<text x="470" y="28" font-size="12.5" fill="${T.soluk}">Son 26 hafta</text>
${kare}
<rect x="470" y="162" width="360" height="10" rx="5" fill="${T.cubukZemin}"/>
<g clip-path="url(#kirp)">${cubuk}</g>
<text x="470" y="153" font-size="12.5" fill="${T.soluk}">En çok kullanılan diller</text>
${dilEtiket}
<text x="30" y="${H - 12}" font-size="10.5" fill="${T.soluk}">${ORNEK ? "örnek veri — gerçek rakamlar ilk güncellemede gelir" : "güncelleme: " + tarih}</text>
</g>
</svg>
`;
}

const veri = ORNEK ? ornekVeri() : await veriTopla();
for (const ad of ["koyu", "acik"]) fs.writeFileSync(path.join(KOK, `assets/istatistik-${ad}.svg`), kart(veri, ad));
console.log("istatistik kartları yazıldı", ORNEK ? "(örnek veri)" : "");
