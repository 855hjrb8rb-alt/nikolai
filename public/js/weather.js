// Clima: ahora, por horas, 7 días, viento, lluvia, neblina, huracanes y mapa en vivo.
// Datos: Open-Meteo (pronóstico y calidad del aire, sin clave), Centro Nacional de
// Huracanes de EE. UU. o GDACS (ciclones activos) y Windy (mapa animado).

import { profile, saveProfile, getLocation } from "./extras.js";
import { renderInto } from "./md.js";

// El último clima se guarda para poder consultarlo sin internet.
export const weather = Object.assign(
  { place: "", data: null, air: null, lat: null, lon: null, error: "", loading: false, at: 0, tab: "now", map: "wind" },
  (() => { try { return JSON.parse(localStorage.getItem("nikolai.weather")) || {}; } catch { return {}; } })(),
  { loading: false, error: "" },
);
const persist = () => {
  try {
    localStorage.setItem("nikolai.weather", JSON.stringify({ data: weather.data, air: weather.air, place: weather.place, lat: weather.lat, lon: weather.lon, at: weather.at }));
  } catch { /* lleno */ }
};

const WMO = {
  0: ["clear", "☀"], 1: ["mainlyClear", "🌤"], 2: ["partlyCloudy", "⛅"], 3: ["overcast", "☁"], 45: ["fog", "🌫"], 48: ["fog", "🌫"],
  51: ["drizzle", "🌦"], 53: ["drizzle", "🌦"], 55: ["drizzle", "🌦"], 61: ["rain", "🌧"], 63: ["rain", "🌧"], 65: ["heavyRain", "🌧"],
  71: ["snow", "🌨"], 73: ["snow", "🌨"], 75: ["snow", "🌨"], 80: ["showers", "🌦"], 81: ["showers", "🌦"], 82: ["heavyRain", "⛈"],
  95: ["storm", "⛈"], 96: ["storm", "⛈"], 99: ["storm", "⛈"],
};
export const wmo = (code) => WMO[code] || ["unknown", "·"];

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
export const compass = (deg) => COMPASS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
/** Escala de Beaufort a partir de km/h. */
export function beaufort(kmh) {
  const limits = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
  const n = limits.findIndex((l) => kmh < l);
  return n === -1 ? 12 : n;
}

async function geocode(name, lang) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=${lang}`);
  const j = await r.json();
  const g = j.results?.[0];
  if (!g) throw new Error("not found");
  return { lat: g.latitude, lon: g.longitude, place: [g.name, g.admin1, g.country_code].filter(Boolean).join(", ") };
}

export async function loadWeather(lang, city = profile.city) {
  weather.loading = true;
  weather.error = "";
  try {
    let loc = null;
    if (city) loc = await geocode(city, lang);
    else {
      const pos = await getLocation();
      if (pos) loc = { ...pos, place: "" };
    }
    if (!loc) throw new Error("no location");
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
      "&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,is_day,wind_speed_10m,wind_gusts_10m,wind_direction_10m,pressure_msl,cloud_cover" +
      "&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,visibility,uv_index,relative_humidity_2m" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,uv_index_max,sunrise,sunset" +
      "&timezone=auto&forecast_days=7";
    const r = await fetch(url);
    weather.data = await r.json();
    weather.place = loc.place;
    weather.lat = loc.lat;
    weather.lon = loc.lon;
    weather.at = Date.now();
    try {
      const a = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${loc.lat}&longitude=${loc.lon}&current=us_aqi,pm2_5,pm10,ozone&timezone=auto`);
      weather.air = (await a.json()).current || null;
    } catch { weather.air = null; }
    persist();
  } catch (e) {
    weather.error = e.message;
  } finally {
    weather.loading = false;
  }
}

/** Índice de la hora actual dentro del pronóstico por horas. */
function hourIndex(d) {
  const now = d.current?.time ? d.current.time.slice(0, 13) : new Date().toISOString().slice(0, 13);
  const i = d.hourly.time.findIndex((tt) => tt.slice(0, 13) === now);
  return Math.max(0, i);
}

/** Avisos calculados a partir del pronóstico de las próximas 24 h (no son alertas oficiales). */
export function warnings(t) {
  const d = weather.data;
  if (!d) return [];
  const i0 = hourIndex(d), H = d.hourly, out = [];
  const range = (k) => H[k].slice(i0, i0 + 24);
  const maxGust = Math.max(d.current.wind_gusts_10m || 0, ...range("wind_gusts_10m"));
  const rain = range("precipitation").reduce((a, b) => a + b, 0);
  const minVis = Math.min(...range("visibility"));
  const maxUv = Math.max(...range("uv_index"));
  const maxT = Math.max(...range("temperature_2m")), minT = Math.min(...range("temperature_2m"));
  const storm = range("weather_code").some((c) => c >= 95);
  if (maxGust >= 90) out.push(["danger", t("wr_wind3").replace("{v}", Math.round(maxGust))]);
  else if (maxGust >= 60) out.push(["warn", t("wr_wind2").replace("{v}", Math.round(maxGust))]);
  if (rain >= 50) out.push(["danger", t("wr_rain3").replace("{v}", Math.round(rain))]);
  else if (rain >= 20) out.push(["warn", t("wr_rain2").replace("{v}", Math.round(rain))]);
  if (storm) out.push(["warn", t("wr_storm")]);
  if (minVis < 1000) out.push(["warn", t("wr_fog").replace("{v}", minVis < 200 ? "<200" : Math.round(minVis))]);
  if (maxUv >= 8) out.push(["warn", t("wr_uv").replace("{v}", Math.round(maxUv))]);
  if (maxT >= 38) out.push(["danger", t("wr_heat").replace("{v}", Math.round(maxT))]);
  if (minT <= 3) out.push(["warn", t("wr_cold").replace("{v}", Math.round(minT))]);
  return out;
}

export function weatherSentence(t) {
  const d = weather.data;
  if (!d) return t("wxError");
  const c = d.current;
  let s = t("wxSay")
    .replace("{place}", weather.place || "")
    .replace("{temp}", Math.round(c.temperature_2m))
    .replace("{desc}", t("wx_" + wmo(c.weather_code)[0]))
    .replace("{max}", Math.round(d.daily.temperature_2m_max[0]))
    .replace("{min}", Math.round(d.daily.temperature_2m_min[0]))
    .replace("{rain}", d.daily.precipitation_probability_max[0] ?? 0);
  s += " " + t("wxWindSay").replace("{v}", Math.round(c.wind_speed_10m)).replace("{g}", Math.round(c.wind_gusts_10m ?? c.wind_speed_10m)).replace("{dir}", compass(c.wind_direction_10m ?? 0));
  const w = warnings(t);
  if (w.length) s += " " + t("wxWarnSay") + " " + w.map((x) => x[1]).join(". ") + ".";
  return s;
}

// ---------- Huracanes y tormentas tropicales ----------
export const storms = { list: null, source: "", error: "", at: 0, brief: "", busy: false };

const KM = (a, b) => {
  const R = 6371, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(x)));
};
const CLASS = { TD: "td", TS: "ts", HU: "hu", MH: "mh", STD: "td", STS: "ts", PTC: "ptc", PC: "ptc", TY: "hu", STY: "mh" };

/** Ciclones activos: primero el NHC (Atlántico y Pacífico este), si no GDACS (todo el mundo). */
export async function loadStorms() {
  storms.error = "";
  try {
    const j = await (await fetch("https://www.nhc.noaa.gov/CurrentStorms.json", { cache: "no-store" })).json();
    storms.list = (j.activeStorms || []).map((s) => ({
      name: s.name, kind: CLASS[s.classification] || "ts", windKt: Number(s.intensity) || null, pressure: Number(s.pressure) || null,
      lat: s.latitudeNumeric, lon: s.longitudeNumeric, move: s.movementDir != null ? `${compass(s.movementDir)} ${Math.round((s.movementSpeed || 0) * 1.852)} km/h` : "",
      url: s.publicAdvisory?.url || "https://www.nhc.noaa.gov/", updated: s.lastUpdate,
    }));
    storms.source = "NHC · NOAA";
  } catch {
    try {
      const j = await (await fetch("https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC")).json();
      storms.list = (j.features || []).filter((f) => String(f.properties?.iscurrent) === "true").map((f) => ({
        name: f.properties.name || f.properties.eventname, kind: "ts", alert: f.properties.alertlevel,
        windKt: null, info: f.properties.severitydata?.severitytext || "", lat: f.geometry?.coordinates?.[1], lon: f.geometry?.coordinates?.[0],
        url: f.properties.url?.report || "https://www.gdacs.org/", updated: f.properties.todate,
      }));
      storms.source = "GDACS";
    } catch (e) {
      storms.list = null;
      storms.error = e.message || "error";
    }
  }
  storms.at = Date.now();
  return storms;
}

// ---------- Interfaz ----------
const TABS = ["now", "hourly", "daily", "wind", "rain", "storms", "map"];
const MAPS = ["wind", "gust", "rain", "thunder", "visibility", "temp", "clouds", "waves"];

const bar = (v, max, cls = "") => `<i class="wbar ${cls}" style="height:${Math.max(3, Math.min(100, (v / (max || 1)) * 100))}%"></i>`;
const arrow = (deg) => `<span class="warrow" style="transform:rotate(${(deg + 180) % 360}deg)">↑</span>`;
const hh = (iso, lang) => new Date(iso).toLocaleTimeString(lang, { hour: "numeric" });

/** ctx = { t, esc, tile, icon, lang, speak, stream, errorText, onUpdate } */
export function renderWeather(body, ctx) {
  const { t, esc, tile, lang } = ctx;
  const d = weather.data;
  const head = `
    <div class="form-row">
      <input class="field" id="wxCity" placeholder="${esc(t("city"))}" value="${esc(profile.city)}">
      ${tile(esc(t("search")), "", "")}${tile(esc(t("myLocation")), "", "")}
    </div>
    <div class="tabs" id="wxTabs">${TABS.map((k) => tile(esc(t("wt_" + k)), "", weather.tab === k ? "on" : "")).join("")}</div>`;
  let html = head;
  if (!d || weather.loading) {
    html += `<p class="muted">${esc(weather.error ? t("wxError") : t("loading"))}</p>`;
  } else {
    const c = d.current, H = d.hourly, D = d.daily, i0 = hourIndex(d);
    const ws = warnings(t);
    const warnHtml = ws.length ? `<div class="wx-warns">${ws.map(([lvl, txt]) => `<div class="wx-warn ${lvl}">${esc(txt)}</div>`).join("")}</div>` : "";
    const age = weather.at && Date.now() - weather.at > 3 * 3600_000 ? `<p class="notice-err">${esc(t("wxOld").replace("{h}", Math.round((Date.now() - weather.at) / 3600_000)))}</p>` : "";
    const next = (k, n = 24) => H[k].slice(i0, i0 + n);

    if (weather.tab === "now") {
      const [key, glyph] = wmo(c.weather_code);
      const vis = H.visibility[i0];
      const aqi = weather.air?.us_aqi;
      html += age + warnHtml + `
        <div class="wx-now">
          <span class="wx-glyph">${glyph}</span>
          <div><div class="wx-temp">${Math.round(c.temperature_2m)}°</div><div class="wx-desc">${esc(t("wx_" + key))}${weather.place ? " · " + esc(weather.place) : ""}</div></div>
        </div>
        <div class="grid-stats">
          <div class="readout"><div class="k">${esc(t("feelsLike"))}</div><div class="v">${Math.round(c.apparent_temperature)}°</div></div>
          <div class="readout"><div class="k">${esc(t("wind"))}</div><div class="v">${arrow(c.wind_direction_10m)} ${Math.round(c.wind_speed_10m)} km/h</div></div>
          <div class="readout"><div class="k">${esc(t("gusts"))}</div><div class="v">${Math.round(c.wind_gusts_10m)} km/h</div></div>
          <div class="readout"><div class="k">${esc(t("rainChance"))}</div><div class="v">${D.precipitation_probability_max[0] ?? 0}%</div></div>
          <div class="readout"><div class="k">${esc(t("humidity"))}</div><div class="v">${c.relative_humidity_2m}%</div></div>
          <div class="readout"><div class="k">${esc(t("visibility"))}</div><div class="v">${vis >= 10000 ? "10+ km" : (vis / 1000).toFixed(1) + " km"}</div></div>
          <div class="readout"><div class="k">${esc(t("uv"))}</div><div class="v">${Math.round(H.uv_index[i0] ?? 0)} <small class="mono">MAX ${Math.round(D.uv_index_max[0] ?? 0)}</small></div></div>
          <div class="readout"><div class="k">${esc(t("pressure"))}</div><div class="v">${Math.round(c.pressure_msl)} hPa</div></div>
          ${aqi != null ? `<div class="readout"><div class="k">${esc(t("airQuality"))}</div><div class="v">${aqi} <small class="mono">${esc(t(aqi <= 50 ? "aq_good" : aqi <= 100 ? "aq_ok" : aqi <= 150 ? "aq_sens" : "aq_bad"))}</small></div></div>` : ""}
          <div class="readout"><div class="k">${esc(t("sun"))}</div><div class="v small">☀ ${hh(D.sunrise[0], lang)} · ☾ ${hh(D.sunset[0], lang)}</div></div>
        </div>
        <div class="tiles">${tile(`${ctx.icon("speaker")}<br>${esc(t("readAloud"))}`, "", "action wx-read")}</div>`;
    } else if (weather.tab === "hourly") {
      const temps = next("temperature_2m"), max = Math.max(...temps), min = Math.min(...temps);
      html += warnHtml + `<div class="wx-hours">${temps.map((tv, k) => {
        const i = i0 + k;
        return `<div class="wx-hour">
          <span class="mono">${hh(H.time[i], lang)}</span><span class="g">${wmo(H.weather_code[i])[1]}</span>
          <b>${Math.round(tv)}°</b>
          <div class="wbar-box">${bar(tv - min + 2, max - min + 2, "temp")}</div>
          <small class="rain">${H.precipitation_probability[i] ?? 0}%</small>
          <small>${arrow(H.wind_direction_10m[i])} ${Math.round(H.wind_speed_10m[i])}</small>
        </div>`;
      }).join("")}</div><p class="muted mono">${esc(t("hourlyLegend"))}</p>`;
    } else if (weather.tab === "daily") {
      html += warnHtml + `<div class="wx-week">${D.time.map((day, i) => `
        <div class="wx-dayrow">
          <span class="mono">${new Date(day + "T12:00").toLocaleDateString(lang, { weekday: "short", day: "numeric" })}</span>
          <span class="g">${wmo(D.weather_code[i])[1]}</span>
          <span>${esc(t("wx_" + wmo(D.weather_code[i])[0]))}</span>
          <b>${Math.round(D.temperature_2m_max[i])}° <small>${Math.round(D.temperature_2m_min[i])}°</small></b>
          <span class="rain">💧 ${D.precipitation_probability_max[i] ?? 0}% · ${(D.precipitation_sum[i] ?? 0).toFixed(1)} mm</span>
          <span>${arrow(D.wind_direction_10m_dominant[i])} ${Math.round(D.wind_speed_10m_max[i])} / ${Math.round(D.wind_gusts_10m_max[i])} km/h</span>
        </div>`).join("")}</div>`;
    } else if (weather.tab === "wind") {
      const sp = next("wind_speed_10m"), gu = next("wind_gusts_10m"), max = Math.max(...gu, 10);
      const bf = beaufort(c.wind_speed_10m);
      html += warnHtml + `
        <div class="wx-wind">
          <div class="compass"><span class="n">N</span><span class="e">E</span><span class="s">S</span><span class="w">O</span>
            <i class="needle" style="transform:rotate(${(c.wind_direction_10m + 180) % 360}deg)"></i></div>
          <div>
            <div class="wx-temp">${Math.round(c.wind_speed_10m)} <small>km/h</small></div>
            <div class="wx-desc">${esc(t("from"))} ${compass(c.wind_direction_10m)} (${Math.round(c.wind_direction_10m)}°) · ${esc(t("gusts"))} ${Math.round(c.wind_gusts_10m)} km/h</div>
            <div class="wx-desc">Beaufort ${bf} · ${esc(t("bf_" + bf))}</div>
          </div>
        </div>
        <div class="readout"><div class="k">${esc(t("next24"))} · ${esc(t("wind"))} / ${esc(t("gusts"))} (km/h)</div>
          <div class="wx-bars">${sp.map((v, k) => `<div class="wbar-col" title="${hh(H.time[i0 + k], lang)}">${bar(gu[k], max, "gust")}${bar(v, max, "wind")}</div>`).join("")}</div>
          <div class="wx-axis mono"><span>${hh(H.time[i0], lang)}</span><span>${hh(H.time[i0 + 12], lang)}</span><span>${hh(H.time[i0 + 23], lang)}</span></div>
        </div>`;
    } else if (weather.tab === "rain") {
      const pr = next("precipitation"), pp = next("precipitation_probability"), vis = next("visibility");
      const maxP = Math.max(...pr, 1);
      const total = pr.reduce((a, b) => a + b, 0);
      const firstRain = pr.findIndex((v, k) => v >= 0.2 || pp[k] >= 60);
      html += warnHtml + `
        <div class="grid-stats">
          <div class="readout"><div class="k">${esc(t("rain24"))}</div><div class="v">${total.toFixed(1)} mm</div></div>
          <div class="readout"><div class="k">${esc(t("rainWhen"))}</div><div class="v small">${firstRain < 0 ? esc(t("rainNone")) : esc(t("rainAt").replace("{h}", hh(H.time[i0 + firstRain], lang)))}</div></div>
          <div class="readout"><div class="k">${esc(t("fogMin"))}</div><div class="v">${Math.min(...vis) >= 10000 ? "10+ km" : (Math.min(...vis) / 1000).toFixed(1) + " km"}</div></div>
        </div>
        <div class="readout"><div class="k">${esc(t("next24"))} · ${esc(t("rainMm"))} / ${esc(t("rainChance"))}</div>
          <div class="wx-bars">${pr.map((v, k) => `<div class="wbar-col" title="${hh(H.time[i0 + k], lang)} · ${v.toFixed(1)} mm · ${pp[k]}%">${bar(pp[k], 100, "prob")}${bar(v, maxP, "rainmm")}</div>`).join("")}</div>
          <div class="wx-axis mono"><span>${hh(H.time[i0], lang)}</span><span>${hh(H.time[i0 + 12], lang)}</span><span>${hh(H.time[i0 + 23], lang)}</span></div>
        </div>
        <div class="readout"><div class="k">${esc(t("visibility"))} (km) · ${esc(t("fogHint"))}</div>
          <div class="wx-bars">${vis.map((v, k) => `<div class="wbar-col" title="${hh(H.time[i0 + k], lang)} · ${(v / 1000).toFixed(1)} km">${bar(Math.min(v, 20000), 20000, v < 1000 ? "fog" : "vis")}</div>`).join("")}</div>
        </div>`;
    } else if (weather.tab === "storms") {
      const me = weather.lat != null ? { lat: weather.lat, lon: weather.lon } : null;
      const list = storms.list;
      html += `
        <p class="muted">${esc(t("stormsIntro"))}</p>
        ${list == null ? `<p class="muted">${esc(storms.error ? t("stormsError") : t("loading"))}</p>`
          : !list.length ? `<div class="readout"><div class="v">${esc(t("stormsNone"))}</div><p class="muted mono">${esc(storms.source)}</p></div>`
          : `<div class="storm-list">${list.map((s) => {
            const dist = me && s.lat != null ? KM(me, { lat: s.lat, lon: s.lon }) : null;
            const kmh = s.windKt ? Math.round(s.windKt * 1.852) : null;
            const near = dist != null && dist < 800;
            return `<div class="storm ${s.kind} ${near ? "near" : ""}">
              <div class="storm-name">${esc(t("st_" + s.kind))} <b>${esc(s.name || "—")}</b></div>
              <div class="mono">${kmh ? `${esc(t("wind"))} ${kmh} km/h` : esc(s.info || s.alert || "")}${s.pressure ? ` · ${s.pressure} hPa` : ""}${s.move ? ` · ${esc(t("moving"))} ${esc(s.move)}` : ""}</div>
              ${dist != null ? `<div class="mono">${esc(t("distance"))}: ${dist.toLocaleString(lang)} km${near ? " · " + esc(t("stormNear")) : ""}</div>` : ""}
              <a href="${esc(s.url)}" target="_blank" rel="noopener" data-target>${esc(t("officialReport"))}</a>
            </div>`;
          }).join("")}</div><p class="muted mono">${esc(t("source"))}: ${esc(storms.source)}</p>`}
        <div class="tiles">${tile(`${ctx.icon("send")}<br>${esc(storms.busy ? t("thinking") : t("stormsAi"))}`, "", "action storm-ai" + (storms.busy ? " live" : ""))}${tile(esc(t("wt_map")), "", "storm-map")}</div>
        <div class="hw-out" id="stormBrief"></div>
        <p class="muted">${esc(t("stormsLinks"))} <a href="https://www.nhc.noaa.gov/" target="_blank" rel="noopener">nhc.noaa.gov</a> · <a href="https://smn.conagua.gob.mx/" target="_blank" rel="noopener">smn.conagua.gob.mx</a></p>`;
    } else if (weather.tab === "map") {
      const lat = weather.lat ?? 23.6, lon = weather.lon ?? -102.5;
      html += `
        <div class="tabs" id="wxMapTabs">${MAPS.map((m) => tile(esc(t("map_" + m)), "", weather.map === m ? "on" : "")).join("")}</div>
        <iframe class="wx-map" title="Windy" loading="lazy"
          src="https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=mm&metricTemp=%C2%B0C&metricWind=km%2Fh&zoom=5&overlay=${weather.map}&product=ecmwf&level=surface&lat=${lat}&lon=${lon}&detailLat=${lat}&detailLon=${lon}&marker=true"></iframe>
        <p class="muted">${esc(t("mapNote"))}</p>`;
    }
  }
  body.innerHTML = html;

  // ---- eventos ----
  const [search, here] = body.querySelectorAll(".form-row .tile");
  const input = body.querySelector("#wxCity");
  const go = async (city) => {
    profile.city = city; saveProfile();
    weather.loading = true; weather.error = "";
    renderWeather(body, ctx);
    await loadWeather(lang, city);
    if (body.isConnected) renderWeather(body, ctx);
    ctx.onUpdate?.();
  };
  search.addEventListener("click", () => go(input.value.trim()));
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(input.value.trim()); });
  here.addEventListener("click", () => go(""));
  body.querySelectorAll("#wxTabs .tile").forEach((el, i) => el.addEventListener("click", () => {
    weather.tab = TABS[i];
    renderWeather(body, ctx);
    if (TABS[i] === "storms" && (storms.list == null || Date.now() - storms.at > 15 * 60_000)) loadStorms().then(() => body.isConnected && renderWeather(body, ctx));
  }));
  body.querySelector(".wx-read")?.addEventListener("click", () => ctx.speak(weatherSentence(t)));
  body.querySelectorAll("#wxMapTabs .tile").forEach((el, i) => el.addEventListener("click", () => { weather.map = MAPS[i]; renderWeather(body, ctx); }));
  const out = body.querySelector("#stormBrief");
  if (out && storms.brief) renderInto(out, storms.brief);
  body.querySelector(".storm-map")?.addEventListener("click", () => { weather.tab = "map"; weather.map = "wind"; renderWeather(body, ctx); });
  body.querySelector(".storm-ai")?.addEventListener("click", async () => {
    if (storms.busy) return;
    storms.busy = true; storms.brief = "";
    renderWeather(body, ctx);
    let full = "";
    try {
      const err = await ctx.stream(
        { messages: [{ role: "user", content: t("stormsPrompt").replace("{place}", weather.place || profile.city || t("nw_defaultRegion")) }], mode: "news", channel: "text" },
        { onText: (dd) => { full += dd; const o = body.querySelector("#stormBrief"); if (o) renderInto(o, full); } },
      );
      storms.brief = full || ctx.errorText(err);
    } catch { storms.brief = t("errGeneric"); }
    storms.busy = false;
    if (body.isConnected) renderWeather(body, ctx);
  });
  if (!d && !weather.loading && !weather.error) go(profile.city);
  if (weather.tab === "storms" && storms.list == null && !storms.error) loadStorms().then(() => body.isConnected && renderWeather(body, ctx));
}

