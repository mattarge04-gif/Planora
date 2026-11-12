import { TOKENS as t } from '../../../app/web/src/design/tokens';

const root = document.documentElement;
for (const [name, value] of Object.entries(t.farbe)) root.style.setProperty(`--${name}`, value);
root.style.setProperty('--schrift', t.typografie.familie);
root.style.setProperty('--daten', `${t.typografie.groessePx.daten}px`);
root.style.setProperty('--textgroesse', `${t.typografie.groessePx.text}px`);
root.style.setProperty('--titelgroesse', `${t.typografie.groessePx.seitentitel}px`);
root.style.setProperty('--kartentitel', `${t.typografie.groessePx.kartentitel}px`);
root.style.setProperty('--normal', String(t.typografie.gewicht.normal));
root.style.setProperty('--betont', String(t.typografie.gewicht.betont));
root.style.setProperty('--zeile', String(t.typografie.zeilenhoehe.daten));
root.style.setProperty('--panelradius', `${t.radius.panelPx}px`);
root.style.setProperty('--kachelradius', `${t.radius.kachelPx}px`);
root.style.setProperty('--panelschatten', t.schatten.panel);
root.style.setProperty('--objektschatten', t.schatten.objekt);

const row = (name: string, value: string | number) => `<div class="row"><span>${name}</span><b>${value}</b></div>`;
const section = (title: string, content: string) => `<section class="panel"><h2>${title}</h2>${content}</section>`;
const labels: Record<keyof typeof t.farbe, string> = {
  grund: 'Grund', flaeche: 'Fläche', flaecheSekundaer: 'Fläche 2', grau1: 'Grau 1 · Rahmen', grau2: 'Grau 2 · Details', grau3: 'Grau 3 · Dekor',
  text: 'Text', textSekundaer: 'Sekundärtext', eis: 'Eis · Auswahl', eisAkzent: 'Eis · Akzent', kooHeizung: 'KOO · Heizung',
  statusOk: 'Status · bestätigt', statusWarnung: 'Status · Warnung', statusStoerung: 'Status · Störung',
};

document.querySelector('#uebersicht')!.innerHTML = `
<header><div><h1>Planora · Gemeinsame Design-Tokens</h1><p>Richtung A · Architekturatelier · Teilaufgabe 2</p></div><span class="source">Quelle: app/web/src/design/tokens.ts</span></header>
<section class="palette" aria-label="Gemeinsame Farbpalette">${Object.entries(t.farbe).map(([key, value]) => `<div class="swatch"><span class="colour" data-colour="${value}"></span><div><h3>${labels[key as keyof typeof labels]}</h3><p>${value}</p></div></div>`).join('')}</section>
<div class="grid">
${section('Typografie', Object.entries(t.typografie.groessePx).map(([k,v])=>row(k,`${v} px`)).join('')+row('Gewichte', Object.values(t.typografie.gewicht).join(' / '))+row('Zeilenhöhe', `${t.typografie.zeilenhoehe.daten} / ${t.typografie.zeilenhoehe.titel}`)+`<p class="note">Inter Variable · ${t.typografie.ziffern}</p>`)}
${section('Abstände und Radien', row('Abstandsskala',`${t.abstand.skalaPx.join(' / ')} px`)+row('Seitenrand',`${t.abstand.seitenrandPx} px`)+row('Panel / Kachel / Pill',`${t.radius.panelPx} / ${t.radius.kachelPx} / ${t.radius.pillPx} px`)+row('Plattenkante',`${t.radius.platteM} m`)+row('Gerätekante',`${t.radius.geraetM} m`)+`<p class="note">UI in px · 3D in m · Basis ${t.abstand.basisPx} px</p>`)}
${section('Flächen und Schatten', row('Paneldeckkraft',t.flaeche.panelDeckkraft)+row('Weichzeichner',`${t.flaeche.weichzeichnerPx} px`)+row('Rahmen',`${t.flaeche.rahmenPx} px · ${t.flaeche.rahmen}`)+`<div class="shadowexamples"><div class="panelshadow">Panel</div><div class="objectshadow">Objektkarte</div></div><p class="note shadowvalue">${t.schatten.panel}<br>${t.schatten.objekt}</p>`)}
${section('Materialien', `<div class="row materialhead"><span>Material</span><span>Rauheit / Metallanteil</span></div>`+Object.entries(t.material).map(([k,v])=>row(k,`${v.roughness} / ${v.metalness}`)).join('')+row('Glasdeckkraft',t.material.glas.deckkraft))}
${section('Licht', row('Tone-Mapping',t.licht.toneMapping)+row('Belichtung',t.licht.belichtung)+row('Umgebung / Sonne',`${t.licht.umgebungIntensitaet} / ${t.licht.sonneIntensitaet}`)+row('Sonne · Azimut / Höhe',`${t.licht.sonneAzimutGrad}° / ${t.licht.sonneHoeheGrad}°`)+row('Schatten einmalig',`${t.licht.schattenFrames} Frames`)+`<p class="note">Arbeitswerte bis zur GPU-Szenenabnahme</p>`)}
${section('Bewegung', row('Hover / Panel',`${t.bewegung.hoverMs} / ${t.bewegung.panelMs} ms`)+row('Kamera / Separieren',`${t.bewegung.kameraMs} / ${t.bewegung.separierenMs} ms`)+row('Reduzierte Bewegung',`${t.bewegung.reduziertMs} ms`)+`<p class="curve">${t.bewegung.kurve}</p><p class="note">Nur als Antwort auf eine Handlung</p>`)}
</div>
<footer><span>Werte direkt importiert · Noch keine Anbindung an bestehende Ansichten</span><span>Statusfarben nur für tatsächliche Zustände</span></footer>`;
for (const swatch of document.querySelectorAll<HTMLElement>('[data-colour]')) swatch.style.backgroundColor = swatch.dataset.colour!;
window.__PLANORA_MOCKUP_READY__ = true;
