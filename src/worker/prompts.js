const fs = require('fs');
const path = require('path');

const SOUL_DIR = path.join(__dirname, '../soul');

function loadSoulFile(name) {
  const filePath = path.join(SOUL_DIR, name);
  return fs.readFileSync(filePath, 'utf8');
}

function buildPrompt(context) {
  const persona = loadSoulFile('persona.md');
  const systemTemplate = loadSoulFile('system-prompt.md');
  const rules = loadSoulFile('cycle-rules.md');
  const examples = loadSoulFile('examples.md');

  let system = systemTemplate
    .replace('{{day_number}}', context.dayNumber)
    .replace('{{current_html}}', context.currentHtml || '(tom — ingen kod ännu)')
    .replace('{{current_css}}', context.currentCss || '(ingen CSS)')
    .replace('{{current_js}}', context.currentJs || '(ingen JS)')
    .replace('{{recent_journal}}', context.recentJournal || '(inga tidigare inlägg — detta är din första dag)');

  const fullSystem = [persona, system, rules, examples].join('\n\n---\n\n');

  const user = `Det är dag ${context.dayNumber}. Vad gör du idag?`;

  return { system: fullSystem, user };
}

function buildFollowUpPrompt(context) {
  const user = `Bra start! Fortsätt bygga vidare. Här är ditt senaste steg:\n\n${context.previousStepResponse}\n\nFörfina och slutför. Svara med samma JSON-format.`;
  return { user };
}

module.exports = { buildPrompt, buildFollowUpPrompt };
