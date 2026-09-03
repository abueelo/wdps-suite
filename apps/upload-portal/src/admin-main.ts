import '@wdps/shared-ui/styles/tokens.css';
import '@wdps/shared-ui/styles/terminal.css';
import './app.css';
import { mount } from 'svelte';
import AdminApp from './AdminApp.svelte';

const app = mount(AdminApp, { target: document.getElementById('app')! });

export default app;
