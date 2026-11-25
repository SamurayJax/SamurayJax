// README'deki iki bölümü yazı olarak (resim değil) yeniden üretir; telefonda ekrana göre akar.
//   <!--PROJELER:BASLA--> … <!--PROJELER:BITIR-->       ← araclar/projeler.json
//   <!--ISTATISTIK:BASLA--> … <!--ISTATISTIK:BITIR-->   ← GitHub GraphQL API
// Kullanım:
//   GH_TOKEN=... GH_KULLANICI=SamurayJax node araclar/guncelle.mjs
//   node araclar/guncelle.mjs --ornek     (ağ yok; örnek istatistikle görünüm denemesi)
// Gizli depoları da saymak için GH_TOKEN, depolara okuma izni olan kişisel erişim jetonu (PROFIL_TOKEN) olmalı.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const README = path.join(KOK, "README.md");
const ORNEK = process.argv.includes("--ornek");
const KULLANICI = process.env.GH_KULLANICI || "SamurayJax";

/* ---------- projeler ---------- */
function projelerBolumu() {
  const gruplar = JSON.parse(fs.readFileSync(path.join(KOK, "araclar/projeler.json"), "utf8"));
  return gruplar.map(g => {
    const satirlar = g.projeler.map(p => {
      const ad = p.baglanti ? `[**${p.ad}**](${p.baglanti})` : `**${p.ad}**`;
      const etiket = p.etiketler.map(e => "`" + e + "`").join(" ");
      return `- ${p.emoji} ${ad} — ${p.aciklama}<br>${etiket} · <sub>${p.durum}</sub>`;
    });
    return `#### ${g.grup}\n\n${satirlar.join("\n")}`;
  }).join("\n\n");
}

/* ---------- istatistikler ---------- */
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
      nodes { isPrivate languages(first: 10, orderBy: {field: SIZE, direction: DESC}) { edges { size node { name } } } }
    }
  }
}`;

async function graphql(degiskenler) {
  const yanit = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${process.env.GH_TOKEN}`, "Content-Type": "application/json", "User-Agent": "profil-guncelle" },
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
  const c = ilk.contributionsCollection, diller = {};
  for (const d of depolar) for (const e of d.languages.edges) diller[e.node.name] = (diller[e.node.name] || 0) + e.size;
  return {
    yillikKatki: c.contributionCalendar.totalContributions,
    commit: c.totalCommitContributions + c.restrictedContributionsCount,
    depo: ilk.repositories.totalCount,
    gizliDepo: depolar.filter(d => d.isPrivate).length,
    gunler: c.contributionCalendar.weeks.flatMap(w => w.contributionDays),
    diller,
  };
}

function ornekVeri() {
  const gunler = [];
  for (let i = 0; i < 365; i++) gunler.push({ contributionCount: i > 360 ? 2 : i % 3 ? 1 : 0 });
  return { yillikKatki: 838, commit: 812, depo: 21, gizliDepo: 14, gunler,
    diller: { TypeScript: 590, JavaScript: 288, "C#": 210, Python: 180, Java: 41, HTML: 4 } };
}

function seriler(gunler) {
  let enUzun = 0, sayac = 0, simdiki = 0;
  for (const g of gunler) { sayac = g.contributionCount > 0 ? sayac + 1 : 0; enUzun = Math.max(enUzun, sayac); }
  const ters = [...gunler].reverse();
  for (let i = ters[0] && ters[0].contributionCount === 0 ? 1 : 0; i < ters.length && ters[i].contributionCount > 0; i++) simdiki++;
  return { simdiki, enUzun };
}

function cubuk(oran, uzunluk = 20) {
  const dolu = Math.round(oran * uzunluk);
  return "█".repeat(dolu) + "░".repeat(uzunluk - dolu);
}

function istatistikBolumu(v) {
  const { simdiki, enUzun } = seriler(v.gunler);
  const toplam = Object.values(v.diller).reduce((a, b) => a + b, 0) || 1;
  const enCok = Object.entries(v.diller).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const enUzunAd = Math.max(...enCok.map(([ad]) => ad.length), 4);
  const satirlar = enCok.map(([ad, boyut]) => {
    const oran = boyut / toplam;
    return `${ad.padEnd(enUzunAd + 2)}${cubuk(oran)}  ${(oran * 100).toFixed(1).padStart(4)} %`;
  });
  const depo = v.gizliDepo ? `${v.depo} <sub>(${v.gizliDepo} gizli)</sub>` : `${v.depo}`;
  const tarih = ORNEK ? "örnek veri" : "son güncelleme " + new Date().toISOString().slice(0, 10);
  return [
    `📈 **${v.yillikKatki}** katkı <sub>son 1 yıl</sub> · 🔨 **${v.commit}** commit <sub>bu yıl</sub><br>`,
    `📦 **${depo}** depo · 🔥 **${simdiki} gün** seri <sub>en uzun ${enUzun}</sub>`,
    "",
    "**En çok kullandığım diller**",
    "",
    "```text",
    ...satirlar,
    "```",
    "",
    `<sub>${tarih} · her gün kendiliğinden yenilenir</sub>`,
  ].join("\n");
}

/* ---------- README'ye yaz ---------- */
function yerlestir(metin, ad, icerik) {
  const bas = `<!--${ad}:BASLA-->`, son = `<!--${ad}:BITIR-->`;
  const i = metin.indexOf(bas), j = metin.indexOf(son);
  if (i < 0 || j < i) throw new Error(`README'de ${bas} … ${son} işaretleri bulunamadı`);
  return metin.slice(0, i + bas.length) + "\n" + icerik + "\n" + metin.slice(j);
}

let readme = fs.readFileSync(README, "utf8");
readme = yerlestir(readme, "PROJELER", projelerBolumu());
readme = yerlestir(readme, "ISTATISTIK", istatistikBolumu(ORNEK ? ornekVeri() : await veriTopla()));
fs.writeFileSync(README, readme);
console.log("README güncellendi", ORNEK ? "(örnek veri)" : "");
