let state = { notes: [] },
  editing = null,
  pending = null;
const $ = (s) => document.querySelector(s);
function error(message) {
  $('#error').textContent = message;
  $('#error').hidden = !message;
}
async function api(path, method = 'GET', data, key) {
  const headers = { 'Content-Type': 'application/json' };
  if (key) headers['Idempotency-Key'] = key;
  const r = await fetch('/api/' + path, {
    method,
    headers,
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  let value;
  try {
    value = await r.json();
  } catch {
    throw Error('Refresh and sign in again to continue.');
  }
  if (!r.ok) throw Error(value.error || 'Request failed.');
  return value;
}
function reset() {
  editing = null;
  pending = null;
  $('#editor').reset();
  $('#mode').textContent = 'Add a note';
  $('#cancel').hidden = true;
}
async function refresh() {
  state = await api('state');
  $('#identity').textContent = state.user.local
    ? 'Local preview · isolated local database'
    : state.user.email;
  $('#logout').hidden = !!state.user.local;
  $('#notes').replaceChildren();
  for (const note of state.notes) {
    const article = document.createElement('article'),
      title = document.createElement('h3'),
      body = document.createElement('p');
    title.textContent = note.title;
    body.textContent = note.body;
    article.append(title, body);
    for (const action of ['Edit', 'Delete']) {
      const b = document.createElement('button');
      b.textContent = action;
      b.setAttribute('aria-label', action + ' ' + note.title);
      b.addEventListener('click', async () => {
        if (action === 'Edit') {
          editing = note.id;
          $('#title').value = note.title;
          $('#body').value = note.body;
          $('#mode').textContent = 'Edit note';
          $('#cancel').hidden = false;
          $('#title').focus();
        } else if (confirm('Delete this note?')) {
          try {
            await api('notes/' + note.id, 'DELETE');
            if (editing === note.id) reset();
            await refresh();
            error('');
          } catch (e) {
            error(e.message);
          }
        }
      });
      article.append(b);
    }
    $('#notes').append(article);
  }
  if (!state.notes.length) $('#notes').textContent = 'No notes yet. Add your first note above.';
}
$('#cancel').addEventListener('click', reset);
$('#editor').addEventListener('submit', async (e) => {
  e.preventDefault();
  const record = { title: $('#title').value, body: $('#body').value };
  const encoded = JSON.stringify(record);
  if (!editing && pending?.body !== encoded) pending = { key: crypto.randomUUID(), body: encoded };
  $('#save').disabled = true;
  try {
    await api(
      'notes' + (editing ? '/' + editing : ''),
      editing ? 'PUT' : 'POST',
      record,
      editing ? null : pending.key,
    );
    reset();
    await refresh();
    error('');
  } catch (e) {
    error(e.message);
  } finally {
    $('#save').disabled = false;
  }
});
refresh().catch((e) => {
  error(e.message);
  $('#notes').textContent = 'Unable to load notes.';
});
