import '@wdps/shared-ui/styles/tokens.css';
import '@wdps/shared-ui/styles/terminal.css';
import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';

const app = mount(App, { target: document.getElementById('app')! });

export default app;
