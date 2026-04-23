/** Formulaire d'ajout rapide d'un adhérent. Utilisé standalone + inline dans l'import. */

import { el, alert as uiAlert, spinner } from './helpers.js';
import { saveAdherent } from '../../store/index.js';

/**
 * @param {object} opts
 * @param {object} [opts.prefill] — valeurs initiales {prenom, nom, sexe}
 * @param {(adh:object) => void} [opts.onDone] — callback après succès
 * @param {() => void} [opts.onCancel]
 * @returns {HTMLElement}
 */
export function adherentForm({ prefill = {}, onDone, onCancel } = {}) {
  const card = el('div.card', { style: 'background: #fbfaf6; border-color: var(--c-bleu);' });
  card.appendChild(el('h3', {}, 'Ajouter un adhérent'));

  const status = el('div');
  const inputs = {};
  const row1 = el('div.row');
  [
    ['prenom',        'Prénom',         'text',   true],
    ['nom',           'Nom',            'text',   true],
  ].forEach(([k, label, type, required]) => {
    inputs[k] = el('input', { type, value: prefill[k] || '', required });
    row1.appendChild(el('div.field', { style: 'flex: 1;' }, [el('label', {}, label + (required ? ' *' : '')), inputs[k]]));
  });
  card.appendChild(row1);

  const row2 = el('div.row');
  inputs.sexe = el('select', {}, [
    el('option', { value: '' }, '—'),
    el('option', { value: 'M', selected: prefill.sexe === 'M' }, 'M'),
    el('option', { value: 'F', selected: prefill.sexe === 'F' }, 'F'),
  ]);
  row2.appendChild(el('div.field', {}, [el('label', {}, 'Sexe'), inputs.sexe]));

  inputs.date_naissance = el('input', { type: 'date', value: prefill.date_naissance || '' });
  row2.appendChild(el('div.field', {}, [el('label', {}, 'Date de naissance'), inputs.date_naissance]));

  inputs.groupe = el('input', { type: 'text', value: prefill.groupe || '' });
  row2.appendChild(el('div.field', {}, [el('label', {}, 'Groupe'), inputs.groupe]));
  card.appendChild(row2);

  card.appendChild(status);

  const btns = el('div.row', { style: 'margin-top: 8px;' }, [
    el('button.btn.btn-primary', { onclick: submit }, 'Ajouter'),
    el('button.btn.btn-ghost', { onclick: () => onCancel && onCancel() }, 'Annuler'),
  ]);
  card.appendChild(btns);

  async function submit() {
    const data = {
      prenom: inputs.prenom.value.trim(),
      nom: inputs.nom.value.trim(),
      sexe: inputs.sexe.value,
      date_naissance: inputs.date_naissance.value,
      groupe: inputs.groupe.value.trim(),
      actif: 'oui',
    };
    if (!data.prenom || !data.nom) {
      status.replaceChildren(uiAlert('warn', 'Prénom et nom sont obligatoires.'));
      return;
    }
    status.replaceChildren(uiAlert('info', el('span', {}, [spinner(), ' Enregistrement…'])));
    try {
      const { adherent } = await saveAdherent(data);
      status.replaceChildren(uiAlert('ok', `Adhérent créé : ${adherent.prenom} ${adherent.nom}`));
      if (onDone) onDone(adherent);
    } catch (e) {
      status.replaceChildren(uiAlert('err', 'Erreur : ' + (e.message || e)));
    }
  }

  return card;
}
