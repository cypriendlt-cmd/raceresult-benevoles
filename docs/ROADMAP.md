# Roadmap — extensions futures

> Idées pour faire évoluer la Base Club. Aucune ne casse l'architecture actuelle. Priorité = effort × valeur perçue par le club.

## Module sondages — extensions

### Notifications / rappels (S)
- **Quoi** : envoyer un rappel WhatsApp/email aux adhérents qui n'ont pas répondu à un sondage avant la date limite.
- **Faisabilité** : un GAS scheduler (déclencheur quotidien) qui regarde `CoursesCiblees.statut=publiee` + `date_limite_reponse` proche, croise avec `ReponsesSondage`, et appelle l'API d'un service externe (Twilio, SendGrid, ou un Slack/Discord webhook).
- **Limite** : nécessite un compte payant chez le fournisseur, ou que le club soit déjà dans Slack/Discord.

### Liaison sondage ↔ résultats post-course (M)
- **Quoi** : après la course, comparer la liste des "j'y vais" avec les résultats scrapés. Afficher : qui a tenu sa promesse, qui a déclaré forfait, qui a couru sans avoir répondu.
- **Faisabilité** : ajouter un champ `match_resultat_id` dans `ReponsesSondage`, peuplé après import. Vue admin qui croise les deux.
- **Limite** : matching à faire (le résultat scrapé ne contient pas l'ID adhérent).

### Statistiques annuelles club (S)
- **Quoi** : "En 2026, X adhérents ont répondu à Y sondages, taux de transformation oui→participation Z%".
- **Faisabilité** : agrégat simple sur `ReponsesSondage`. Vue dans le dashboard bureau.

### Covoiturage / logement / repas (M)
- **Quoi** : champs supplémentaires sur la réponse pour coordonner la logistique.
- **Discuté et reporté** : V1 volontairement minimal (oui/non/peut-être + distance). À ajouter seulement si demande concrète.

## Base club — extensions

### Génération posts Facebook / Instagram (M)
- **Quoi** : à partir d'une course importée, générer un texte type "10 Ch'tis ont couru le marathon de Lille hier 🏃 Bravo à @prenom1, @prenom2…".
- **Faisabilité** : template + Apps Script qui poste via l'API Meta. Ou copy-to-clipboard pour publication manuelle.

### Export Excel / PDF (S)
- **Quoi** : depuis la fiche adhérent ou la chronique club, bouton "Exporter en .xlsx" ou "PDF".
- **Faisabilité** : SheetJS (xlsx.js) pour Excel, jsPDF pour PDF. ~50 lignes par format.
- **Limite** : ajoute une dépendance bundle (incompatible avec "zéro npm" actuel — accepter ou faire en CSV simple).

### Galerie photos / souvenirs (M)
- **Quoi** : associer des photos à une course. Vue "souvenirs" dans la chronique.
- **Faisabilité** : un onglet `Photos` (FK course_id, URL Drive/Imgur), composant carrousel.
- **Limite** : hébergement des photos (Drive du club ? Cloudinary gratuit ?).

### Classement interne opt-in (M)
- **Quoi** : pour les adhérents qui le souhaitent (case à cocher dans la fiche), afficher un classement interne par distance.
- **Discuté et écarté à l'origine** : l'esprit du club est "régularité + mémoire", pas "podium". Ne réintroduire qu'avec opt-in explicite.

### Détection automatique nouvelles courses (L)
- **Quoi** : surveiller les calendriers régionaux (Athle.fr Hauts-de-France) et proposer automatiquement des courses ciblées candidates.
- **Faisabilité** : scraping périodique via Apps Script. Pré-remplit des brouillons dans `CoursesCiblees`.

## Architecture / dette technique

### Migration option A2 (backend + DB) (XL)
- **Quand** : si le club dépasse 20 k lignes dans `Resultats`, ou si Apps Script atteint ses quotas régulièrement, ou si on veut ajouter une vraie auth (Google OAuth pour login adhérent).
- **Cible probable** : Supabase (PostgreSQL + auth + Realtime gratuit < 500 MB) ou un backend Node + SQLite déployé sur Fly.io / Railway.
- **Plan** : la couche `src/store/` est déjà conçue comme façade. Refactor de `sheets.js` + `appsScript.js` → un nouveau `supabase.js` ou `api.js`. Le reste du front ne change pas.
- **Coût** : 1-2 jours de refactor + 1 service externe à maintenir.

### PWA / mode hors ligne (M)
- **Quoi** : que les adhérents puissent consulter les sondages sans connexion (cache des dernières données).
- **Faisabilité** : `service-worker.js` simple + `manifest.json`. ~50 lignes.
- **Valeur** : faible aujourd'hui (les usages se font à la maison ou au club, en wifi).

### Whitelist du proxy Cloudflare (S)
- **Quoi** : aujourd'hui le worker proxy n'importe quelle URL. Ajouter une whitelist de domaines (docs.google.com, api Apps Script).
- **Pourquoi** : éviter qu'un tiers utilise notre proxy comme relai gratuit.
- **Coût** : 5 lignes dans le worker.

## Légende effort

- **S** : 1-2h de code
- **M** : ½ journée à 1 journée
- **L** : 2-3 jours
- **XL** : 1 semaine+

---

**Dernière mise à jour** : 2026-04-27 (J7)
