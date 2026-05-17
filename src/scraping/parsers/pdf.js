/**
 * Parseur PDF — reconstruit les lignes texte via coordonnées PDF.js puis
 * applique une heuristique token-par-token pour extraire rang/nom/prénom/temps.
 *
 * PDF.js est chargé côté navigateur via CDN (cf. index.html). Pour les tests unitaires
 * on teste uniquement `parseLignes` qui accepte un array de strings (sortie de
 * `regrouperParLigne`), évitant la dépendance runtime.
 */

import { normalizeLigne, normalizeCourse, parseDistanceKm, deduireType } from '../normalize.js';
import { parseDate } from '../../utils/date.js';
import { tempsEnSecondes } from '../../utils/time.js';

const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';

/** Charge pdf.js depuis CDN si absent. Côté browser uniquement. */
async function ensurePdfJs() {
  if (typeof window === 'undefined') {
    throw new Error('PDF : parseFile requiert un environnement navigateur');
  }
  if (typeof window.pdfjsLib !== 'undefined') return window.pdfjsLib;
  // Chargement dynamique via <script>
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = PDFJS_CDN + 'pdf.min.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('PDF : impossible de charger pdf.js depuis le CDN'));
    document.head.appendChild(s);
  });
  if (typeof window.pdfjsLib === 'undefined') throw new Error('PDF : pdfjsLib absent après chargement');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_CDN + 'pdf.worker.min.js';
  return window.pdfjsLib;
}

/** Lit un File (ou Blob) PDF et renvoie des lignes de texte reconstruites. */
export async function extraireLignes(file) {
  const lib = await ensurePdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await lib.getDocument({ data: arrayBuffer }).promise;
  const toutes = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    regrouperParLigne(content.items).forEach((l) => toutes.push(l));
  }
  return toutes;
}

/**
 * Regroupe les items PDF par coordonnée Y (même ligne) et les trie par X. Exposé pour tests.
 *
 * Clustering linéaire : on trie par Y décroissant et on accumule dans le cluster courant
 * tant que l'écart avec le Y de référence du cluster est < TOL. Contrairement à un bucketing
 * par `Math.round(y/TOL)*TOL`, cette approche n'a pas d'effet de frontière : deux items
 * distants de 0.2 ne peuvent pas tomber dans des clusters différents juste parce qu'ils
 * sont de part et d'autre d'un multiple de TOL.
 *
 * Incident : Preux-au-Sart 14km 2026 — les temps officiels étaient rendus avec un baseline
 * shift de +0.18 vs le reste de la ligne (police bold). Sur les Y tombant pile à la frontière
 * (ex. 578.96 vs 579.14 → buckets 578 vs 580), le temps se retrouvait seul → l'allure (3:58)
 * était importée comme temps total.
 */
export function regrouperParLigne(items) {
  const TOL = 2;
  const valides = items.filter((it) => it.str && it.str.trim());
  valides.sort((a, b) => b.transform[5] - a.transform[5]);

  const clusters = [];
  let courant = null;
  for (const it of valides) {
    const y = it.transform[5];
    if (!courant || Math.abs(y - courant.yRef) > TOL) {
      courant = { yRef: y, items: [it] };
      clusters.push(courant);
    } else {
      courant.items.push(it);
    }
  }

  return clusters
    .map(({ items: arr }) => {
      const triPareX = arr.sort((a, b) => a.transform[4] - b.transform[4]);
      let texte = '';
      let lastX = null;
      triPareX.forEach((it) => {
        const x = it.transform[4];
        if (lastX !== null && x - lastX > 2 && texte && !texte.endsWith(' ')) texte += ' ';
        texte += it.str;
        lastX = x + (it.width || 0);
      });
      return texte.replace(/\s+/g, ' ').trim();
    })
    .filter((l) => l.length > 0);
}

/**
 * Parse une liste de lignes texte (extraites du PDF) vers des lignes normalisées.
 * Stratégie : ancre sur le premier temps HH:MM:SS de la ligne, extrait rang,
 * dossard optionnel, NOM (majuscules consécutives) puis prénom (casse mixte).
 * Suit les en-têtes courants (catégorie, parcours).
 */
export function parseLignes(lignes) {
  const regexTemps = /\b(\d{1,2}:\d{2}(?::\d{2})?)\b/;

  function estMajuscule(tok) {
    if (!tok) return false;
    if (!/[A-ZÀ-Þ]/.test(tok)) return false;
    return !/[a-zà-ÿ]/.test(tok);
  }

  const lignesOut = [];
  let categorieCourante = '';
  let parcoursCourant = '';

  lignes.forEach((ligne) => {
    if (!ligne || ligne.length < 5) return;
    const tempsMatch = ligne.match(regexTemps);

    if (!tempsMatch) {
      if (ligne.length < 80) {
        const upper = ligne.toUpperCase();
        if (/^\d+\s?KM\b/i.test(upper)) {
          parcoursCourant = ligne.replace(/\s+/g, ' ').trim();
        } else if (
          /^(CADETS?|JUNIORS?|ESPOIRS?|SENIORS?|MASTERS?|VETERANS?|M\d|V\d|SE|SEN|CA|JU|ES)\b/i.test(upper) ||
          /^(HOMMES?|FEMMES?|GARCONS?|GARÇONS?|FILLES?)\b/i.test(upper)
        ) {
          categorieCourante = ligne.replace(/\s+/g, ' ').trim();
        }
      }
      return;
    }

    const tempsOff = tempsMatch[1];
    const avant = ligne.slice(0, tempsMatch.index).trim();
    const apres = ligne.slice(tempsMatch.index + tempsMatch[0].length);

    const tokens = avant.split(/\s+/);
    if (tokens.length < 3) return;

    const rangMatch = tokens[0].match(/^(\d+)\.?$/);
    if (!rangMatch) return;
    const rang = rangMatch[1];
    let i = 1;

    let dossard = '';
    if (i < tokens.length && /^\d{1,6}$/.test(tokens[i])) {
      dossard = tokens[i];
      i++;
    }

    const nomParts = [];
    while (i < tokens.length) {
      if (/^\(\d+\)$/.test(tokens[i])) { i++; continue; }
      if (!estMajuscule(tokens[i])) break;
      nomParts.push(tokens[i]);
      i++;
    }
    if (nomParts.length === 0) return;

    const prenomParts = [];
    while (i < tokens.length) {
      const t = tokens[i];
      if (/^\(\d+\)$/.test(t)) { i++; continue; }
      if (estMajuscule(t) || /^\d+$/.test(t)) break;
      prenomParts.push(t);
      i++;
    }
    if (prenomParts.length === 0) return;

    // Cherche un éventuel temps net dans la suite. ATTENTION : la colonne "Moy."
    // (allure min/km, ex. "3:24") matche le même regex que les temps. On rejette
    // tout candidat dont la magnitude est très différente du temps officiel
    // (l'allure est ~5x plus petite que le temps total). Voir Dour 5km 2026.
    const officielSec = tempsEnSecondes(tempsOff);
    const regexTempsGlobal = /(\d{1,2}:\d{2}(?::\d{2})?)/g;
    let tempsNet = tempsOff;
    let mm;
    while ((mm = regexTempsGlobal.exec(apres)) !== null) {
      const before = apres.charAt(mm.index - 1);
      if (before === '+' || before === '-') continue;
      const candidatSec = tempsEnSecondes(mm[1]);
      if (officielSec && candidatSec) {
        if (candidatSec < officielSec * 0.5 || candidatSec > officielSec * 1.05) continue;
      }
      tempsNet = mm[1];
      break;
    }

    const ligneNorm = normalizeLigne({
      prenom: prenomParts.join(' '),
      nom: nomParts.join(' '),
      tempsOfficiel: tempsOff,
      tempsNet,
      rang,
      dossard,
      categorie: categorieCourante || null,
    });
    if (ligneNorm) {
      // conserver parcoursCourant pour dispatch multi-course
      lignesOut.push({ ligne: ligneNorm, parcours: parcoursCourant });
    }
  });

  return lignesOut;
}

/**
 * Extrait date + distance + nom de course du PDF.
 *
 * - Date : cherche dans TOUT le document (PDF a souvent la date en pied).
 * - Distance : "Xkm" ou "X km" n'importe où.
 * - Nom : ligne courte, sans temps/chiffres de classement, qui se répète
 *   souvent (header/footer sur chaque page). Exclut les titres génériques
 *   ("Classement général", etc.).
 */
export function extraireMetaPDF(lignesTexte) {
  const tout = lignesTexte.join(' \n ');

  // Date : cherche dans tout le doc, prend la 1re valide
  let date = null;
  const patterns = [
    /\b(\d{4}-\d{1,2}-\d{1,2})\b/,
    /\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\b/,
    /\b(\d{1,2}\s+(?:janvier|fevrier|février|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre|janv|fevr|févr|avr|juil|sept|oct|nov|dec|déc)\.?\s+\d{4})\b/i,
  ];
  for (const p of patterns) {
    const m = tout.match(p);
    if (m) {
      const parsed = parseDate(m[1]);
      if (parsed) { date = parsed; break; }
    }
  }

  // Distance : "10 km", "7km (6850m)", "21,1 km" — privilégie la 1re occurrence
  let distance_km = null;
  const distM = tout.match(/(\d+(?:[.,]\d+)?)\s*km\b/i);
  if (distM) distance_km = parseDistanceKm(distM[0]);

  // Nom de course : ligne courte, répétée sur plusieurs pages (header/footer)
  const GENERIC = /^(classement|resultats|résultats|general|général|page|nombre|clt|chrono)\b/i;
  const occurrences = new Map();
  for (const l of lignesTexte) {
    const t = l.trim();
    if (t.length < 5 || t.length > 120) continue;
    if (/\d{1,2}:\d{2}/.test(t)) continue;           // ligne de résultat
    if (/^\d+[.\s]/.test(t)) continue;               // commence par "42." etc.
    if (/page\s*\d+\s*\/\s*\d+/i.test(t)) continue;  // pagination
    if (/chronolap|racetiming|my\.raceresult/i.test(t)) continue;
    if (GENERIC.test(t)) continue;
    occurrences.set(t, (occurrences.get(t) || 0) + 1);
  }
  // Ligne la + répétée = probablement le titre
  let nomCourse = null;
  let maxCount = 0;
  for (const [ligne, n] of occurrences) {
    if (n > maxCount) { maxCount = n; nomCourse = ligne; }
  }
  // Fallback : 1re ligne courte non générique
  if (!nomCourse) {
    for (const l of lignesTexte.slice(0, 10)) {
      const t = l.trim();
      if (t.length >= 5 && t.length <= 120 && !GENERIC.test(t) && !/\d{1,2}:\d{2}/.test(t) && !/^\d+[.\s]/.test(t)) {
        nomCourse = t; break;
      }
    }
  }

  return { date, distance_km, nomCourse };
}

/** API publique : parseFile(File) → { courses }. Nécessite navigateur + pdf.js. */
export async function parseFile(file, { nom = file?.name || 'PDF', url = null } = {}) {
  const lignesTexte = await extraireLignes(file);
  const parsed = parseLignes(lignesTexte);
  if (parsed.length === 0) throw new Error('PDF : aucune ligne de résultat détectée');

  const meta = extraireMetaPDF(lignesTexte);

  // Regroupe par parcours courant ; si un seul parcours → une course
  const parCours = new Map();
  parsed.forEach(({ ligne, parcours }) => {
    const k = parcours || '__default__';
    const bag = parCours.get(k) || [];
    bag.push(ligne);
    parCours.set(k, bag);
  });

  const courses = [];
  for (const [parcours, lignes] of parCours) {
    // Distance par parcours (ex. "10 KM") si extraite sinon meta globale
    const distParcours = parcours === '__default__' ? meta.distance_km : (parseDistanceKm(parcours) ?? meta.distance_km);
    const nomBase = meta.nomCourse || nom.replace(/\.(pdf|PDF)$/, '');
    const nomFinal = parcours === '__default__' ? nomBase : nomBase + ' — ' + parcours;
    courses.push({
      course: normalizeCourse({
        nom: nomFinal,
        date: meta.date,
        distance_km: distParcours,
        type: deduireType({ nom: nomFinal, distance_km: distParcours }),
        source: 'pdf',
        url,
      }),
      lignes,
    });
  }
  return { courses };
}
