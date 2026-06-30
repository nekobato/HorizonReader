import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import { registerIcons } from './icons'
import './styles.css'

registerIcons()

createApp(App).use(createPinia()).mount('#app')
