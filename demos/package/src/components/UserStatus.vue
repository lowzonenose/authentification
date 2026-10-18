<script setup>
import { computed } from 'vue';
import { useAuth } from 'authentification-vue-oidc';

const { user, isAuthenticated, status } = useAuth();
const userName = computed(() => user.value?.name || user.value?.email || user.value?.sub || '');
</script>

<template>
  <p class="status">
    <span v-if="status === 'initializing'">Initialisation…</span>
    <span v-else-if="isAuthenticated">Connecté : <strong>{{ userName }}</strong></span>
    <span v-else>Non connecté</span>
  </p>
</template>
