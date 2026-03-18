// config.js
// Since Express serves ALL the frontend files, API calls
// can always use relative paths (no hardcoded localhost).
// This works locally on port 3000 AND on Railway/Render.

const API_BASE = '';   // always same origin — Express handles it

async function apiFetch(path, options) {
  return fetch(API_BASE + path, options);
}
