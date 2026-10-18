<script setup lang="js">
import { computed } from 'vue';
import { useAuth } from 'authentification-vue-oidc';
import NotConnected from '../components/NotConnected.vue';

const { user, isAuthenticated } = useAuth();
const profile = computed(() => user.value?.claims || {});
</script>

<template>
  <section>
    <h2>Profil</h2>

    <NotConnected v-if="!isAuthenticated" />

    <div v-else>
      <dl>
        <dt>Prénom</dt><dd>{{ profile.given_name || '-' }}</dd>
        <dt>Nom</dt><dd>{{ profile.family_name || user.name || '-' }}</dd>
        <dt>Identifiant</dt><dd>{{ profile.preferred_username || user.sub }}</dd>
        <dt>Email</dt><dd>{{ user.email || '-' }}</dd>
        <dt>Rôles</dt><dd>{{ user.roles.join(', ') || '-' }}</dd>
      </dl>

      <details>
        <summary>Claims du profil</summary>
        <pre>{{ profile }}</pre>
      </details>
    </div>
  </section>
</template>

<style scoped>
dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.25rem 1rem;
  margin-bottom: 1rem;
}

dt {
  font-weight: 600;
}
</style>
