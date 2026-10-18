# Démonstration Vue 3

Cette application consomme le package compilé `authentification-vue-oidc` depuis son export npm. Elle expose la configuration OIDC, l'état de session, les événements et les claims sans afficher les tokens.

Après l'initialisation, le sélecteur propose deux vues : **Événements**, un journal compact des événements `useAuth().on()` déclenchés par login/logout/erreurs/renouvellement, et **Session**, la vue détaillée de l'identité et des claims. Les deux vues partagent le même composable.

## Démarrage

Depuis la racine `/demos/advanced`:

```sh
cp demos/advanced/.env.example demos/advanced/.env.
npm install
npm run dev
```

Les URI `VITE_IAM_REDIRECT_URI` et `VITE_IAM_SILENT_REDIRECT_URI` doivent être autorisées exactement pour le client dans l'IdP. La seconde sert `public/silent-renew.html`, qui relaie la réponse de l'iframe à `oidc-client-ts` sur la même origine. Pour une configuration uniquement dans l'interface, laisser les variables IAM non définies.

Les paramètres `VITE_IAM_*` sont publics et intégrés au bundle de démonstration ; n'y place aucun secret.