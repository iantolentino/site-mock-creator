const $ = id => document.getElementById(id);
// Presentation-only helper; reuse the local SVG sprite without a runtime dependency.
function createIcon(symbol) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', symbol);
  svg.append(use);
  return svg;
}
let selectedFile = null;
let busy = false;
let nextPage = null;
let items = new Map();
const MAX_SIZE = 2 * 1024 * 1024;
function message(text = '') { $('message').textContent = text; $('message').hidden = !text; }
function baseName() { return $('name').value.trim().toLowerCase().replace(/(?:-test-mockup|-mockup|-test)+$/, ''); }
function updateName() { $('url-preview').textContent = `${location.host}/view/${baseName() || 'your-name'}-test-mockup`; }
function showWorkspace(yes) {
  $('login-panel').hidden = yes; $('publisher-panel').hidden = !yes; $('library').hidden = !yes; $('logout').hidden = !yes;
}
async function api(action, body) {
  const response = await fetch(`/api/publisher?action=${action}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const data = await response.json().catch(() => ({ error: 'The server returned an unexpected response.' }));
  if (!response.ok) {
    if (response.status === 401) showWorkspace(false);
    throw new Error(data.error || 'Request failed.');
  }
  return data;
}
function chooseFile(file) {
  if (!file) return;
  selectedFile = null;
  $('file-name').textContent = 'Drop your HTML here';
  $('file-detail').textContent = 'or click to browse · .html / .htm · up to 2 MB';
  if (!/\.html?$/i.test(file.name)) { message('Choose an .html or .htm file.'); $('file').value = ''; return; }
  if (!file.size || file.size > MAX_SIZE) { message('Choose a non-empty HTML file no larger than 2 MB.'); $('file').value = ''; return; }
  selectedFile = file;
  $('file-name').textContent = file.name;
  $('file-detail').textContent = `${(file.size / 1024).toFixed(1)} KB · ready to publish · click to change`;
  message();
}
function renderList() {
  const target = $('mockup-list'); target.replaceChildren();
  if (!items.size) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'Your collection starts with one upload. Publish your first mockup above.'; target.append(empty); }
  for (const item of items.values()) {
    const row = document.createElement('article'); row.className = 'mockup-row';
    const icon = document.createElement('span'); icon.className = 'mockup-icon'; icon.append(createIcon('#icon-file-code'));
    const info = document.createElement('div'); info.className = 'mockup-info';
    const title = document.createElement('strong'); title.textContent = item.name;
    const subtitle = document.createElement('p'); subtitle.textContent = `${location.host}${item.path}`;
    info.append(title, subtitle);
    const actions = document.createElement('div'); actions.className = 'row-actions';
    const badge = document.createElement('span'); badge.className = 'badge'; badge.textContent = 'Test mockup';
    const edit = document.createElement('button'); edit.className = 'quiet'; edit.textContent = 'Update'; edit.disabled = busy;
    edit.onclick = () => { $('name').value = item.name.replace(/-test-mockup$/, ''); $('replace').checked = true; updateName(); $('name').focus(); $('publisher-panel').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    const open = document.createElement('a'); open.textContent = 'Open'; open.append(createIcon('#icon-external-link')); open.href = item.path; open.target = '_blank'; open.rel = 'noopener noreferrer';
    actions.append(badge, edit, open); row.append(icon, info, actions); target.append(row);
  }
  $('load-more').hidden = !nextPage;
}
async function loadList(more = false) {
  const result = await api(`list${more && nextPage ? `&cursor=${encodeURIComponent(nextPage)}` : ''}`);
  if (!more) items = new Map();
  for (const item of result.items) if (!items.has(item.name)) items.set(item.name, item);
  nextPage = result.next; renderList();
}
function setBusy(value) {
  busy = value;
  for (const id of ['name', 'file', 'replace', 'publish-button', 'logout', 'refresh', 'load-more']) $(id).disabled = value;
  $('publish-label').textContent = value ? 'Publishing…' : 'Publish mockup';
  renderList();
}
function displayResult(item) {
  $('publish-result').hidden = false;
  const url = new URL(item.path, location.origin).href;
  $('result-state').textContent = 'SAVED & READY TO SHARE';
  $('result-text').textContent = url;
  $('result-link').hidden = false; $('copy-link').hidden = false;
  $('result-link').href = url; $('copy-link').dataset.url = url;
}
$('name').addEventListener('input', updateName);
$('file').addEventListener('change', event => chooseFile(event.target.files[0]));
for (const event of ['dragenter', 'dragover']) $('dropzone').addEventListener(event, e => { e.preventDefault(); if (!busy) $('dropzone').classList.add('drag'); });
for (const event of ['dragleave', 'drop']) $('dropzone').addEventListener(event, e => { e.preventDefault(); $('dropzone').classList.remove('drag'); });
$('dropzone').addEventListener('drop', e => { if (!busy) chooseFile(e.dataTransfer.files[0]); });
$('login-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.submitter; button.disabled = true;
  try { message(); await api('login', { password: $('password').value }); $('password').value = ''; showWorkspace(true); await loadList(); }
  catch (error) { message(error.message); } finally { button.disabled = false; }
});
$('logout').onclick = async () => { try { await api('logout', {}); showWorkspace(false); items.clear(); $('publish-result').hidden = true; message(); } catch (error) { message(error.message); } };
$('refresh').onclick = async () => { try { message(); await loadList(); } catch (error) { message(error.message); } };
$('load-more').onclick = async () => { try { await loadList(true); } catch (error) { message(error.message); } };
$('copy-link').onclick = async () => { try { await navigator.clipboard.writeText($('copy-link').dataset.url); $('copy-link').textContent = 'Copied!'; setTimeout(() => { $('copy-link').textContent = 'Copy link'; }, 1800); } catch { message('Copy the address displayed above. Clipboard access is unavailable.'); } };
$('publish-form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return;
  if (!selectedFile) return message('Choose an HTML file first.');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(baseName()) || baseName().length > 80) return message('Use 1–80 letters, numbers or single hyphens for the name.');
  message(); setBusy(true); $('publish-result').hidden = true;
  try {
    let html;
    try { html = new TextDecoder('utf-8', { fatal: true }).decode(await selectedFile.arrayBuffer()); }
    catch { throw new Error('Save your file using UTF-8 encoding, then upload it again.'); }
    const result = await api('publish', { name: baseName(), filename: selectedFile.name, html, replace: $('replace').checked });
    displayResult(result);
    await loadList();
  } catch (error) { message(error.message); }
  finally { setBusy(false); }
});
(async () => {
  updateName();
  try { const session = await api('session'); showWorkspace(session.authenticated); if (session.authenticated) await loadList(); }
  catch (error) { message(error.message); }
})();
