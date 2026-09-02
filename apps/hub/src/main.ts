import '@wdps/shared-ui/styles/tokens.css';
import '@wdps/shared-ui/styles/terminal.css';
import './style.css';
import { getStoredTheme, toggleTheme } from '@wdps/shared-ui/theme';
import { bindShortcuts } from '@wdps/shared-ui/shortcuts';

const toggle = document.getElementById('theme-toggle') as HTMLButtonElement;
const modeLabel = toggle.querySelector('.mode') as HTMLSpanElement;

let theme = getStoredTheme();
modeLabel.textContent = theme === 'dark' ? 'light' : 'dark';

toggle.addEventListener('click', () => {
  theme = toggleTheme(theme);
  modeLabel.textContent = theme === 'dark' ? 'light' : 'dark';
});

bindShortcuts({
  t: () => toggle.click(),
  c: () => { window.location.href = '/comp-sheets/'; }
});
