# 2026-04-24 — Helper `el()` : children number non géré

## Symptôme

`Failed to execute 'appendChild' on 'Node': parameter 1 is not of type 'Node'.` au chargement de la vue admin liste des courses ciblées.

## Cause

`src/ui/components/helpers.js#el()` gérait `string` / `Node` / `null` / `false` comme children, mais pas les `number`. Dans `admin-courses-list.js`, les compteurs (`c.oui`, `c.peut_etre`, `c.non`) sont retournés comme nombres par `compterReponses()` et passés tels quels au helper :

```js
el('span.compteur-oui', {}, c.oui)  // c.oui = 3 → appendChild(3) → TypeError
```

## Fix

Rendre le helper tolérant aux `number` — ils sont maintenant convertis en text node comme les strings :

```js
if (typeof c === 'string' || typeof c === 'number') {
  node.appendChild(document.createTextNode(String(c)));
} else {
  node.appendChild(c);
}
```

## Règle à retenir

Les helpers DOM partagés doivent tolérer les types primitifs usuels qu'on passe naturellement (`string`, `number`) sans forcer le call site à les stringify. Cas limites : `boolean`, `bigint`, `Date` → restent en erreur explicite (rarement voulus, mieux vaut planter tôt).

## Angle mort à surveiller

Les vues qui construisent du DOM en chaînant `el()` peuvent échouer silencieusement si un children est d'un type inattendu. L'erreur ne remonte pas avec le chemin exact — il faut la stack. Envisager à terme un mode dev qui warn sur `typeof` inhabituel.
