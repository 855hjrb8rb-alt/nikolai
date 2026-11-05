// Construye mapa/datos/mundo.json: fronteras del mundo (world-atlas 50m) y
// estados de EE. UU. (us-atlas 10m), con nombre en español y facción de la
// línea temporal de la serie «El hombre en el castillo» (Amazon, 1962; interpretación aproximada).
//
// Uso:  node construir-datos.mjs <dir world-atlas> <dir us-atlas> <dir i18n-iso-countries>
// (los tres paquetes se obtienen con `npm pack world-atlas@2.0.2 us-atlas@3.0.1 i18n-iso-countries@7.11.0`)
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const [worldDir, usDir, isoDir] = process.argv.slice(2);
if (!isoDir) { console.error("Faltan rutas. Ver comentario de cabecera."); process.exit(1); }
const leer = (p) => JSON.parse(readFileSync(p, "utf8"));

const world = leer(join(worldDir, "countries-50m.json"));
const us = leer(join(usDir, "states-10m.json"));
const codes = leer(join(isoDir, "codes.json"));
const es = leer(join(isoDir, "langs", "es.json")).countries;

// Facciones: R Gran Reich Nazi · RA Reich Americano · J Imperio Japonés ·
// JP Estados Japoneses del Pacífico · N Zona Neutral · I Imperio Italiano ·
// X Estados neutrales · U Sin reclamar
const F = {
  R: "AUT BEL BGR BIH BLR CZE DEU DNK EST FIN FRA GBR HRV HUN LTU LUX LVA MDA MKD MNE NLD NOR POL ROU RUS SRB SVK SVN UKR GRL ISL FRO GGY JEY IMN ALA MCO" +
     " DZA AGO BEN BWA BFA BDI CMR CPV CAF TCD COM COD COG CIV EGY GNQ GAB GMB GHA GIN GNB KEN LSO LBR MDG MWI MLI MRT MUS MAR MOZ NAM NER NGA RWA STP SEN SYC SLE ZAF SSD SDN SWZ TZA TGO UGA ZMB ZWE ESH SHN" +
     " ARM AZE GEO KAZ KGZ TJK TKM UZB AFG IRN IRQ SYR LBN ISR PSE JOR SAU YEM OMN ARE QAT KWT BHR CYP SGS",
  RA: "CAN SPM BMU",
  J: "JPN KOR PRK CHN TWN MNG HKG MAC VNM LAO KHM THA MMR MYS SGP IDN PHL BRN TLS PNG AUS NZL FJI SLB VUT NCL WSM TON KIR FSM MHL PLW NRU TUV PYF GUM MNP ASM WLF COK NIU PCN NFK HMD IOT CXR CCK" +
     " IND BGD LKA NPL BTN PAK MDV",
  I: "ITA ALB SMR VAT MLT GRC LBY ETH ERI SOM DJI TUN",
  X: "CHE LIE SWE ESP PRT AND IRL TUR GIB" +
     " MEX GTM BLZ HND SLV NIC CRI PAN CUB HTI DOM JAM BHS TTO BRB GRD VCT LCA DMA ATG KNA PRI VIR VGB CYM TCA AIA MSR ABW CUW SXM MAF BLM" +
     " COL VEN ECU PER BOL BRA PRY URY ARG CHL GUY SUR FLK",
  U: "ATA ATF",
};
const faccionDe = {};
for (const [f, lista] of Object.entries(F)) for (const a3 of lista.split(/\s+/)) if (a3) faccionDe[a3.replace("?", "")] = f;

const porNumerico = {};
for (const [a2, a3, num] of codes) porNumerico[num] = { a2, a3 };

const nombreEs = (a2, respaldo) => { const n = es[a2]; return Array.isArray(n) ? n[0] : (n || respaldo); };
const sinId = { "Somaliland": ["Somalilandia", "I"], "Kosovo": ["Kosovo", "R"], "N. Cyprus": ["Chipre del Norte", "R"],
  "Indian Ocean Ter.": ["Territorios del Índico", "J"], "Siachen Glacier": ["Glaciar de Siachen", "J"] };

const sinFaccion = [];
world.objects.countries.geometries = world.objects.countries.geometries.filter((g) => g.id !== "840").map((g) => {
  let n, f;
  if (!g.id) [n, f] = sinId[g.properties.name] || [g.properties.name, "X"];
  else {
    const c = porNumerico[g.id];
    n = c ? nombreEs(c.a2, g.properties.name) : g.properties.name;
    f = c && faccionDe[c.a3];
    if (!f) { sinFaccion.push(`${g.id} ${g.properties.name}`); f = "X"; }
  }
  return { ...g, properties: { n, f } };
});

const JP = ["02", "04", "06", "15", "32", "41", "53"];       // AK AZ CA HI NV OR WA
const N = ["08", "16", "30", "35", "49", "56"];             // CO ID MT NM UT WY
const territorios = ["60", "66", "69", "72", "78"];          // ya vienen en el mapa mundial
us.objects.states.geometries = us.objects.states.geometries.filter((g) => !territorios.includes(g.id)).map((g) => ({
  ...g, properties: { n: g.properties.name, f: JP.includes(g.id) ? "JP" : N.includes(g.id) ? "N" : "RA" },
}));
delete us.objects.nation;

const salida = join(dirname(fileURLToPath(import.meta.url)), "..", "datos", "mundo.json");
writeFileSync(salida, JSON.stringify({ mundo: world, eeuu: us }));
console.log("Escrito", salida);
if (sinFaccion.length) console.log("Sin facción asignada (quedan neutrales):", sinFaccion.join(", "));
