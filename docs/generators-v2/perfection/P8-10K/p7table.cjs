/* P8-10K — tabela 12 profila P7 pre/posle (raw-pre.json, raw-posle.json; tekst posle iz plans/ — kako vidi trkač).
   Iz web/: node ../docs/generators-v2/perfection/P8-10K/p7table.cjs [pre] [posle] */
const fs = require("fs");
const dir = __dirname + "/";
const [tA, tB] = [process.argv[2] ?? "pre", process.argv[3] ?? "posle"];
const pre = JSON.parse(fs.readFileSync(dir + `raw-${tA}.json`)).P7, post = JSON.parse(fs.readFileSync(dir + `raw-${tB}.json`)).P7;
const BAD = /nije izvodljiv|odstupanje|cilj po pravilu|\[pravilo\]|ne može da se sastavi|ne nose ovaj obim|plafon|najviše \d+ % nedelje u tom tempu|0,8 × dugog|≤ RP doza|10 % nedelje/i;
const atPeak = (r) => r.targets.filter((t) => t >= r.peak - 0.05).length;
const longAt = (r) => r.longs.filter((l) => l !== null && l >= r.longMax - 0.05).length;
console.log("| profil | vrh obima: ned. prvog / poslednja razvoja | ned. na vrhu | najduži dugi km (ned. na njemu) | ned. sa RP | taper bez RP | ned. > 25 % | tehničkih napomena trkaču |");
console.log("|---|---|---|---|---|---|---|---|");
for (let i = 0; i < pre.length; i++) {
  const a = pre[i], b = post[i];
  const txt = fs.readFileSync(`${dir}plans/${b.id}.txt`, "utf8").split("\n").filter((l) => /Napomena|^\s+- /.test(l));
  const techPre = a.notes.filter((n) => BAD.test(n)).length + a.warnings.length;
  const techPost = txt.filter((l) => BAD.test(l)).length;
  const f = (x, y) => (x === y ? `${x}` : `${x} → ${y}`);
  console.log(`| ${a.id} | ${f(`${a.firstPeak}/${a.lastDev}`, `${b.firstPeak}/${b.lastDev}`)} | ${f(atPeak(a), atPeak(b))} | ${f(`${a.longMax} (${longAt(a)})`, `${b.longMax} (${longAt(b)})`)} | ${f(a.rpWeeks, b.rpWeeks)} | ${f(a.taperNoRP, b.taperNoRP)} | ${f(a.over25, b.over25)} | ${f(techPre, techPost)} |`);
}
