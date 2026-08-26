import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import '@fontsource/fira-code/400.css'
import '@fontsource/fira-code/500.css'
import '@fontsource/fira-code/700.css'
import './style.css'

createApp(App).use(router).mount('#app')
