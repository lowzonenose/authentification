<script setup lang="js">
import { useAuth } from 'authentification-vue-oidc';
import NotConnected from '../components/NotConnected.vue';

const { user, isAuthenticated, status } = useAuth();
</script>

<template>
  <section>
    <h2>Session</h2>

    <NotConnected v-if="!isAuthenticated" />

    <div v-else>
      <dl>
        <dt>Authentifié</dt><dd>{{ isAuthenticated ? 'oui' : 'non' }}</dd>
        <dt>État</dt><dd>{{ status }}</dd>
        <dt>Utilisateur</dt><dd>{{ user.sub }}</dd>
        <dt>Rôles</dt><dd>{{ user.roles.join(', ') || '-' }}</dd>
      </dl>
    </div>
  </section>
</template>

<style scoped>
dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.25rem 1rem;
}

dt {
  font-weight: 600;
}
</style>
