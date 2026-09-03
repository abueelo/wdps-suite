import '@wdps/shared-ui/styles/tokens.css';
import '@wdps/shared-ui/styles/terminal.css';
import './app.css';
import { mount } from 'svelte';
import { setFooterYear } from '@wdps/shared-ui/year';
import AdminApp from './AdminApp.svelte';

const app = mount(AdminApp, { target: document.getElementById('app')! });
setFooterYear();

export default app;
