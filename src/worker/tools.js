const db = require('../shared/db');

const API_STORE_DOCS = `# Data Store API — /api/store

Key-value store. Keys and values are ALWAYS strings.

## Writing — always use POST

POST /api/store — creates or updates (upsert):
  await fetch('/api/store', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'visitor_count', value: '42' })
  });

## Reading

GET /api/store/:key — read one key:
  const res = await fetch('/api/store/visitor_count');
  // { "success": true, "data": { "key": "visitor_count", "value": "42" } }
  // data.value is ALWAYS a string.

GET /api/store?prefix=gb: — list keys by prefix:
  const res = await fetch('/api/store?prefix=gb:');
  // { "success": true, "data": [{ "key": "gb:1001", "value": "{\\"name\\":\\"me\\"}" }] }
  // Each value is a STRING — JSON.parse() it yourself.

## Storing JSON

Stringify when writing, parse when reading:
  // Write
  const value = JSON.stringify({ name: 'PixelCoder', msg: 'hello' });
  await fetch('/api/store', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'gb:' + Date.now(), value })
  });
  // Read
  const data = await res.json();
  data.data.forEach(item => {
    const entry = JSON.parse(item.value);
  });

## Limits
- Max 500 entries per prefix, max 2KB per value, ~500 writes/visitor/hour.
- Deletes require admin access.`;

const toolDefinitions = [
  {
    name: 'list_files',
    description: 'List all files in your workspace with their line counts and sizes.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'read_file',
    description: 'Read the full contents of a file. Always read before editing so you know what\'s there.',
    input_schema: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'The filename to read, e.g. "index.html"' },
      },
      required: ['filename'],
    },
  },
  {
    name: 'write_file',
    description: 'Create or overwrite a file. Always send the COMPLETE file content. Soft limit: ~500 lines per file — split into multiple files if needed.',
    input_schema: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'The filename, e.g. "particles.js". Use lowercase, no spaces.' },
        content: { type: 'string', description: 'The complete file content' },
      },
      required: ['filename', 'content'],
    },
  },
  {
    name: 'delete_file',
    description: 'Delete a file from your workspace. Use when refactoring or cleaning up.',
    input_schema: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'The filename to delete' },
      },
      required: ['filename'],
    },
  },
  {
    name: 'get_api_docs',
    description: 'Get full documentation for the /api/store key-value API, including examples for reading, writing, and storing JSON. Call this before using fetch to /api/store.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
];

async function executeTool(toolName, input) {
  switch (toolName) {
    case 'list_files': {
      const files = await db('workspace_files')
        .select(
          'filename',
          db.raw("length(content) as chars"),
          db.raw("array_length(string_to_array(content, E'\\n'), 1) as lines")
        )
        .orderBy('filename');

      if (files.length === 0) return '(empty workspace — no files yet)';
      return files.map(f => `${f.filename}  (${f.lines || 0} lines, ${f.chars} chars)`).join('\n');
    }

    case 'read_file': {
      const file = await db('workspace_files').where('filename', input.filename).first();
      if (!file) return `Error: file "${input.filename}" not found. Use list_files to see available files.`;
      return file.content;
    }

    case 'write_file': {
      if (!input.filename || !input.content) return 'Error: filename and content are required.';

      // Validate filename
      if (!/^[a-z0-9][a-z0-9._-]*\.(html|css|js)$/i.test(input.filename)) {
        return 'Error: filename must end in .html, .css, or .js and contain only letters, numbers, dots, hyphens.';
      }

      await db('workspace_files')
        .insert({ filename: input.filename, content: input.content, updated_at: db.fn.now() })
        .onConflict('filename')
        .merge({ content: input.content, updated_at: db.fn.now() });

      const lines = input.content.split('\n').length;
      return `Wrote ${input.filename} (${lines} lines, ${input.content.length} chars)`;
    }

    case 'delete_file': {
      const deleted = await db('workspace_files').where('filename', input.filename).del();
      if (!deleted) return `Error: file "${input.filename}" not found.`;
      return `Deleted ${input.filename}`;
    }

    case 'get_api_docs':
      return API_STORE_DOCS;

    default:
      return `Error: unknown tool "${toolName}"`;
  }
}

module.exports = { toolDefinitions, executeTool };
