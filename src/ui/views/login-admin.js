/** Page de login admin — carte centrée, minimaliste. */

import { el, alert } from '../components/helpers.js';
import { loginAdmin, isAdmin, logoutAdmin } from '../../auth/session.js';

export default function renderLoginAdmin(root) {
  const wrap = el('div.login-wrap');

  if (isAdmin()) {
    wrap.appendChild(el('div.card.card-feature', {}, [
      el('span.rule-eyebrow', {}, 'Espace bureau'),
      el('h1', { style: 'margin-top:12px' }, 'Tu es connecté.'),
      el('p.muted', {}, 'Tu as accès à la gestion des courses ciblées et des sondages.'),
      el('div.row', { style: 'margin-top:16px' }, [
        el('a.btn.btn-primary', { href: '#/admin/courses' }, 'Gérer les courses ciblées'),
        (() => {
          const b = el('button.btn.btn-ghost', {}, 'Se déconnecter');
          b.addEventListener('click', () => { logoutAdmin(); location.hash = '#/admin'; location.reload(); });
          return b;
        })(),
      ]),
    ]));
    root.appendChild(wrap);
    return;
  }

  const form = el('form.login-form');
  form.appendChild(el('div.field', {}, [
    el('label', {}, 'Mot de passe bureau'),
    el('input', { name: 'pwd', type: 'password', required: true, autofocus: true, autocomplete: 'current-password' }),
  ]));
  form.appendChild(el('button.btn.btn-primary', { type: 'submit' }, 'Entrer'));
  const feedback = el('div.form-feedback');
  form.appendChild(feedback);

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    feedback.innerHTML = '';
    const pwd = new FormData(form).get('pwd');
    if (loginAdmin(pwd)) {
      location.hash = '#/admin/courses';
    } else {
      feedback.appendChild(alert('err', 'Mot de passe incorrect.'));
    }
  });

  wrap.appendChild(el('div.card', {}, [
    el('span.rule-eyebrow', {}, 'Accès bureau'),
    el('h1', { style: 'margin-top:12px' }, 'Espace administration'),
    el('p.muted', {}, 'Réservé aux membres du bureau pour créer et gérer les sondages de courses ciblées.'),
    form,
  ]));
  root.appendChild(wrap);
}
