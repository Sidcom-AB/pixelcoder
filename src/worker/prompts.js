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

  // Inject persona into system prompt (single source of truth)
  let system = systemTemplate
    .replace('{{persona}}', persona)
    .replace('{{day_number}}', context.dayNumber)
    .replace('{{current_html}}', context.currentHtml || '(empty — no code yet)')
    .replace('{{current_css}}', context.currentCss || '(no CSS)')
    .replace('{{current_js}}', context.currentJs || '(no JS)')
    .replace('{{recent_journal}}', context.recentJournal || '(no previous entries — this is your first day)')
    .replace('{{energy_level}}', context.energyLevel || 'full')
    .replace('{{budget_percent}}', context.budgetPercent ?? 0);

  // Append rules and examples as separate sections
  const fullSystem = [system, rules, examples].join('\n\n---\n\n');

  const user = `It's day ${context.dayNumber}. What are you doing today?`;

  return { system: fullSystem, user };
}

function buildFollowUpPrompt(context) {
  const user = `Good start! Keep building on it. Here's your last step:\n\n${context.previousStepResponse}\n\nRefine and finish. Respond with the same JSON format.`;
  return { user };
}

module.exports = { buildPrompt, buildFollowUpPrompt };
