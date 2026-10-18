<script setup lang="js">
import { RouterLink } from 'vue-router';
import { useAuth } from 'authentification-vue-oidc';
import UserStatus from '../components/UserStatus.vue';

const { isAuthenticated, status, login, logout } = useAuth();

const onConnect = async () => {
  try { await login(); } catch { return; }
};

const onDisconnect = async () => {
  try { await logout(); } catch { return; }
};
</script>

<template>
  <section>
    <h2>Connexion</h2>

    <div v-if="isAuthenticated">
      <UserStatus />
      <p>
        Naviguez vers les autres pages (<RouterLink to="/profil">Profil</RouterLink>,
        <RouterLink to="/session">Session</RouterLink>) :
        votre session est active.
      </p>
      <button :disabled="status === 'authenticating'" @click="onDisconnect">Se déconnecter</button>
    </div>

    <div v-else>
      <p>Connectez-vous via le SSO cartes.gouv.fr pour accéder à vos informations.</p>
      <button :disabled="status === 'authenticating'" @click="onConnect">Se connecter</button>
    </div>
  </section>
</template>
