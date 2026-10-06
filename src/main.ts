import './assets/main.css'
import 'leaflet/dist/leaflet.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { createApiClient } from './api'
import { readConfig } from './config/env'
import { apiClientKey } from './stores/apiClient'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.provide(apiClientKey, await createApiClient(readConfig().api))

app.mount('#app')
