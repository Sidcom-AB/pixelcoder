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

  // Build file manifest
  const manifestLines = context.fileManifest.length > 0
    ? context.fileManifest.map(f => `- ${f.filename}  (${f.lines || 0} lines, ${f.chars} chars)`).join('\n')
    : '(empty workspace — no files yet, start from scratch!)';

  let system = systemTemplate
    .replace('{{persona}}', persona)
    .replace('{{day_number}}', context.dayNumber)
    .replace('{{file_manifest}}', manifestLines)
    .replace('{{recent_journal}}', context.recentJournal || '(no previous entries — this is your first day)')
    .replace('{{energy_level}}', context.energyLevel || 'full')
    .replace('{{budget_percent}}', context.budgetPercent ?? 0);

  // Append rules and examples
  const fullSystem = [system, rules, examples].join('\n\n---\n\n');

  const user = `It's day ${context.dayNumber}. What are you doing today?`;

  return { system: fullSystem, user };
}

module.exports = { buildPrompt };
