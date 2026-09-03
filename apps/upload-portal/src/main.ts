import '@wdps/shared-ui/styles/tokens.css';
import '@wdps/shared-ui/styles/terminal.css';
import './app.css';
import { mount } from 'svelte';
import MemberApp from './MemberApp.svelte';

const app = mount(MemberApp, { target: document.getElementById('app')! });

export default app;
