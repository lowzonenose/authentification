# Reste à faire

Après comparaison de la spécification (cf. ./docs/SPECIFICATIONS-AUTH-VUE.md), du code et des tests présents, voici les points restants.

## **Implémentation Manquante**

| Exigence | Point restant |
|---|---|
| **FR-013 · Should** | Synchronisation login/logout entre onglets : aucun mécanisme dédié présent. |
| **§3.2 / §5.3** | État `refreshing` : déclaré dans l’API, mais jamais affecté pendant un renouvellement. Voir `auth.js`. |
| **§8 · NETWORK_ERROR** | Retry réseau avec backoff absent. Les erreurs de renouvellement sont généralement converties en `REFRESH_FAILED`. |
| **FR-004 · Should** | Restauration de `returnTo` partielle : elle passe uniquement par le guard. Sans cette intégration au routeur, la destination n’est pas appliquée. Voir `guard.js:22`. |
| **NFR-006 · Should** | Aucun mécanisme de traduction fourni pour les messages, actuellement écrits en français. Les codes permettent toutefois une traduction côté application. |
| **FR-015 · Could** | Composant `<AuthGuard>` ou directive `v-auth` absent. Facultatif. |
| **§10 · Livrables** | Guide de migration absent. La référence API est générée par TypeDoc (`npm run docs` → `docs/reference/`) depuis les commentaires de `types/index.d.ts`. |

## **Écarts À Corriger**

- **SEC-002 · Must** : le nonce est généré par notre propre fonction, alors que la spécification impose de déléguer sa génération à la bibliothèque sous-jacente. Implémentation ou exigence à réaligner : `oidc-client-ts.js:71`.
- **FR-005 / SEC-002** : un callback contenant `code` ou `error`, mais dépourvu de `state`, n’est pas explicitement rejeté ; il échappe à la branche de traitement du callback : `oidc-client-ts.js:106`.

## **Validation Restante**

Ces points ne sont pas nécessairement dépourvus d’implémentation, mais les preuves demandées manquent :

- **SEC-003 · Must** : tests de conformité `iss`, `aud`, `exp` et documentation de la validation de signature. Le nonce est déjà testé.
- **FR-020 / FR-021 / FR-026** : tests navigateur du rechargement avec session valide/expirée et de la restauration avec iframe bloquée ou timeout.
- **SEC-008 · Should** : test sous CSP stricte.
- **§9.2** : parcours complet contre un Keycloak en conteneur et validation multi-navigateurs.
- **NFR-008** : mesure des performances d’initialisation ; le seuil `X` reste à définir.
- **§9.2** : couverture et traçabilité de chaque exigence Must à finaliser. La couverture reste volontairement hors gate CI.

SSR/Nuxt, multi-IdP et l’adaptateur `keycloak-js` ne sont pas comptés comme manquants : ils sont hors périmètre v1.

Analyse effectuée sans modifier les fichiers ni rejouer les tests.