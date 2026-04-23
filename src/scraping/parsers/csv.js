/**
 * Parseur CSV — détecte les colonnes via heuristique sur les en-têtes.
 *
 * Accepte soit un `File` (API publique `parseFile`), soit un texte brut
 * (`parseText`) pour les tests unitaires. Une seule course par fichier.
 */

import { parseCSV } from '../../utils/csv.js';
import { normaliser } from '../../utils/text.js';
import { normalizeLigne, normalizeCourse } from '../normalize.js';

/** Parse un texte CSV → { courses: [{ course, lignes }] }. */
export function parseText(text, { nom = 'Import CSV', url = null } = {}) {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error('CSV : fichier vide ou sans données (< 2 lignes)');

  const header = rows[0].map((h) => normaliser(h));

  function trouverIndex(patterns) {
    for (const p of patterns) {
      const idx = header.findIndex((h) => h.includes(p));
      if (idx !== -1) return idx;
    }
    return -1;
  }

  const iRang = trouverIndex(['rang', 'rank', 'place', 'position', 'classement']);
  const iNom = trouverIndex(['nom', 'lastname', 'name', 'nachname']);
  const iPrenom = trouverIndex(['prenom', 'firstname', 'vorname']);
  const iTemps = trouverIndex(['temps', 'time', 'finish', 'officiel']);
  const iTempsNet = trouverIndex(['net', 'netto', 'chip']);
  const iCat = trouverIndex(['cat', 'categorie', 'category', 'agegroup']);
  const iDossard = trouverIndex(['dossard', 'bib', 'numero', 'number', 'startnr']);
  const iSexe = trouverIndex(['sexe', 'sex', 'gender', 'genre']);
  const iClub = trouverIndex(['club', 'team', 'equipe']);

  if (iNom === -1 && iPrenom === -1) {
    throw new Error('CSV : aucune colonne nom/prenom détectée (en-têtes : ' + header.join(', ') + ')');
  }

  const lignes = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((c) => !String(c).trim())) continue;
    const ligne = normalizeLigne({
      rang: iRang !== -1 ? (r[iRang] || '').trim() : String(i),
      nom: iNom !== -1 ? (r[iNom] || '').trim() : '',
      prenom: iPrenom !== -1 ? (r[iPrenom] || '').trim() : '',
      tempsOfficiel: iTemps !== -1 ? (r[iTemps] || '').trim() : '',
      tempsNet: iTempsNet !== -1 ? (r[iTempsNet] || '').trim() : (iTemps !== -1 ? (r[iTemps] || '').trim() : ''),
      categorie: iCat !== -1 ? (r[iCat] || '').trim() : '',
      dossard: iDossard !== -1 ? (r[iDossard] || '').trim() : '',
      sexe: iSexe !== -1 ? (r[iSexe] || '').trim() : '',
      club: iClub !== -1 ? (r[iClub] || '').trim() : '',
    });
    if (ligne) lignes.push(ligne);
  }

  if (lignes.length === 0) throw new Error('CSV : aucune ligne exploitable après parsing');

  return {
    courses: [
      {
        course: normalizeCourse({ nom, source: 'csv', url }),
        lignes,
      },
    ],
  };
}

/** API publique : lit un File CSV et délègue à parseText. */
export async function parseFile(file, { nom, url } = {}) {
  const text = await file.text();
  return parseText(text, { nom: nom || file.name || 'Import CSV', url: url || null });
}
