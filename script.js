let audioPermissionGranted = false;
let notesData = [];
let currentEditIndex = null;
let currentAlarmEnabled = false;
let currentFilter = 'todo';
let currentCategory = 'all';
let currentTag = '';
let currentSort = 'updated';
let searchQuery = '';
let activeAlarmNoteIndex = null;
let pendingAttachments = [];
let currentNoteColor = 'default';

const STORAGE_KEY = 'pwa_notes_data';
const CATEGORIES_KEY = 'pwa_note_categories_v1';
const THEME_KEY = 'pwa_theme';
const ATTACHMENT_DB_NAME = 'notes_alarme_attachments_v1';
const ATTACHMENT_STORE = 'attachments';
const COLORS = ['default', 'blue', 'green', 'yellow', 'red', 'purple', 'pink'];
const ALLOWED_ATTACHMENT_EXTENSIONS = ['md', 'txt', 'json'];
let categoriesData = [];
let attachmentDBPromise = null;

function createNoteId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'note-' + Date.now() + '-' + Math.random().toString(36).slice(2);
}

function normalizeStatus(note) {
    if (['done', 'waiting', 'not_started'].includes(note.status)) return note.status;
    return note.checked ? 'done' : 'not_started';
}

function normalizeNote(note) {
    const normalized = {
        id: note.id || createNoteId(), checked: Boolean(note.checked), email: note.email || '',
        datetime: note.datetime || '', desc: note.desc || '', triggered: Boolean(note.triggered),
        alarmEnabled: Boolean(note.alarmEnabled), status: normalizeStatus(note),
        categoryId: note.categoryId || 'general', favorite: Boolean(note.favorite),
        pinned: Boolean(note.pinned), tags: Array.isArray(note.tags) ? note.tags.filter(Boolean).map(String) : [],
        color: COLORS.includes(note.color) ? note.color : 'default', updatedAt: Number(note.updatedAt) || Date.now()
    };
    normalized.checked = normalized.status === 'done';
    return normalized;
}

function normalizeAllNotes() { notesData = Array.isArray(notesData) ? notesData.map(normalizeNote) : []; }

function normalizeCategories() {
    if (!Array.isArray(categoriesData)) categoriesData = [];
    if (!categoriesData.some(c => c.id === 'general')) categoriesData.unshift({ id: 'general', name: 'Général', icon: '📁', color: 'default' });
    categoriesData = categoriesData.map(c => ({ id: c.id || createNoteId(), name: String(c.name || 'Dossier'), icon: c.icon || '📁', color: c.color || 'default' }));
}

function loadData() {
    try { notesData = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { notesData = []; }
    if (!notesData.length) notesData = [{ id: createNoteId(), checked: false, email: '', datetime: '', desc: 'Bienvenue dans Notes !', triggered: false, alarmEnabled: false, status: 'not_started', categoryId: 'general', favorite: false, pinned: true, tags: ['bienvenue'], color: 'blue', updatedAt: Date.now() }];
    normalizeAllNotes();
    try { categoriesData = JSON.parse(localStorage.getItem(CATEGORIES_KEY) || '[]'); } catch { categoriesData = []; }
    normalizeCategories();
    saveData();
    renderCategories();
    const savedAudio = localStorage.getItem('pwa_custom_audio');
    if (savedAudio) document.getElementById('alarmAudio').src = savedAudio;
    const theme = localStorage.getItem(THEME_KEY) || 'dark';
    document.documentElement.dataset.theme = theme;
    updateThemeIcon();
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notesData));
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categoriesData));
}

function enableAudio() {
    const audio = document.getElementById('alarmAudio');
    audio.play().then(() => { audio.pause(); audio.currentTime = 0; audioPermissionGranted = true; showToast('Sonneries activées'); }).catch(err => console.error('Erreur audio:', err));
    if ('Notification' in window && Notification.permission !== 'granted') Notification.requestPermission();
}

function toggleTheme() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem(THEME_KEY, next);
    updateThemeIcon();
}
function updateThemeIcon() { const el = document.getElementById('themeIcon'); if (el) el.textContent = document.documentElement.dataset.theme === 'dark' ? '☀️' : '🌙'; }

function setFilter(filter, labelText) {
    currentFilter = filter;
    document.querySelectorAll('.filter-chip').forEach(btn => btn.classList.toggle('active', btn.dataset.filter === filter));
    const title = document.getElementById('viewTitle');
    const subtitle = document.getElementById('viewSubtitle');
    const labels = { todo: ['À faire', 'Vos notes actives'], favorite: ['Favoris', 'Vos notes favorites'], pinned: ['Épinglés', 'Notes importantes'], waiting: ['En attente', 'Notes en attente'], done: ['Terminées', 'Notes terminées'] };
    if (title) title.textContent = labels[filter]?.[0] || labelText || 'Notes';
    if (subtitle) subtitle.textContent = labels[filter]?.[1] || '';
    renderList();
}

function setCategory(categoryId) {
    currentCategory = categoryId;
    document.querySelectorAll('.folder-item').forEach(btn => btn.classList.toggle('active', btn.dataset.category === categoryId));
    const category = categoriesData.find(c => c.id === categoryId);
    if (category) { document.getElementById('viewTitle').textContent = category.name; document.getElementById('viewSubtitle').textContent = 'Notes de ce dossier'; }
    else if (categoryId === 'all') setFilter(currentFilter, '');
    renderList();
}

function addCategory() {
    const name = prompt('Nom du nouveau dossier :');
    if (!name || !name.trim()) return;
    categoriesData.push({ id: createNoteId(), name: name.trim(), icon: '📁', color: 'default' });
    saveData(); renderCategories(); showToast('Dossier créé');
}

function renderCategories() {
    const list = document.getElementById('categoryList');
    if (!list) return;
    list.innerHTML = categoriesData.filter(c => c.id !== 'general').map(c => `<button class="folder-item" data-category="${escapeHtml(c.id)}" onclick="setCategory('${escapeJs(c.id)}')"><span>${escapeHtml(c.icon)}</span><span>${escapeHtml(c.name)}</span><b>${notesData.filter(n => n.categoryId === c.id).length}</b></button>`).join('');
    const all = document.getElementById('allCount'); if (all) all.textContent = notesData.length;
    const select = document.getElementById('modalCategory');
    if (select) select.innerHTML = categoriesData.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.icon)} ${escapeHtml(c.name)}</option>`).join('');
}

function matchesFilter(note) {
    const status = normalizeStatus(note);
    if (currentFilter === 'todo') return status !== 'done';
    if (currentFilter === 'favorite') return note.favorite;
    if (currentFilter === 'pinned') return note.pinned;
    if (currentFilter === 'waiting') return status === 'waiting';
    if (currentFilter === 'done') return status === 'done';
    return true;
}

function getFilteredNotes() {
    return notesData.filter(note => {
        const haystack = `${note.email} ${note.desc} ${(note.tags || []).join(' ')}`.toLowerCase();
        if (!haystack.includes(searchQuery)) return false;
        if (currentCategory !== 'all' && note.categoryId !== currentCategory) return false;
        return matchesFilter(note) && (!currentTag || (note.tags || []).includes(currentTag));
    });
}

function sortNotes(list) {
    return list.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (currentSort === 'title') return (a.email || a.desc).localeCompare(b.email || b.desc, 'fr');
        if (currentSort === 'color') return String(a.color).localeCompare(String(b.color));
        if (currentSort === 'date') return (a.datetime ? new Date(a.datetime).getTime() : Infinity) - (b.datetime ? new Date(b.datetime).getTime() : Infinity);
        return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
}

function getStatusInfo(note) {
    const status = normalizeStatus(note);
    if (status === 'done') return { icon: '✓', label: 'Terminé', className: 'done' };
    if (status === 'waiting') return { icon: '⏳', label: 'En attente', className: 'waiting' };
    return { icon: '○', label: 'Pas démarré', className: 'not-started' };
}

function renderList() {
    renderCategories();
    const listContainer = document.getElementById('emailList');
    if (!listContainer) return;
    const filtered = sortNotes(getFilteredNotes());
    listContainer.innerHTML = '';
    const countLabel = document.getElementById('noteCountLabel');
    if (countLabel) countLabel.textContent = `${notesData.length} ${notesData.length === 1 ? 'note' : 'notes'}`;
    renderTagBar();
    if (!filtered.length) { listContainer.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div><h3>Aucune note</h3><p>Créez une note ou modifiez vos filtres.</p><button class="btn-primary empty-add" onclick="openModal()">＋ Nouvelle note</button></div>`; return; }
    filtered.forEach(note => {
        const index = notesData.indexOf(note);
        const status = getStatusInfo(note);
        const category = categoriesData.find(c => c.id === note.categoryId) || categoriesData[0];
        const item = document.createElement('article');
        item.className = `note-card note-color-${note.color}`;
        if (note.triggered && note.alarmEnabled) item.classList.add('triggered');
        item.innerHTML = `
            <div class="note-color-bar"></div>
            <div class="note-card-main">
                <div class="note-card-top">
                    <div class="note-heading">
                        <span class="note-status ${status.className}" title="${status.label}">${status.icon}</span>
                        <h3>${escapeHtml(note.email || 'Note sans titre')}</h3>
                    </div>
                    <div class="note-flags">${note.pinned ? '<span title="Épinglée">📌</span>' : ''}${note.favorite ? '<span title="Favori">★</span>' : ''}</div>
                </div>
                <p class="note-preview">${escapeHtml(note.desc || 'Aucune description')}</p>
                <div class="note-meta"><span>${escapeHtml(category?.icon || '📁')} ${escapeHtml(category?.name || 'Général')}</span>${note.datetime ? `<span>🕒 ${escapeHtml(formatDate(note.datetime))}</span>` : ''}${note.alarmEnabled ? '<span>🔔</span>' : ''}</div>
                <div class="note-footer"><div class="note-tags">${(note.tags || []).slice(0, 4).map(tag => `<button class="tag-chip tag-click" onclick="filterByTag(event,'${escapeJs(tag)}')">#${escapeHtml(tag)}</button>`).join('')}</div><span class="status-label ${status.className}">${status.label}</span></div>
            </div>`;
        item.addEventListener('click', () => openModal(index));
        listContainer.appendChild(item);
    });
}

function renderTagBar() {
    const bar = document.getElementById('tagBar'); if (!bar) return;
    const tags = [...new Set(notesData.flatMap(n => n.tags || []))].sort((a,b) => a.localeCompare(b,'fr'));
    bar.innerHTML = tags.length ? `<span class="tag-label">Tags</span>${tags.map(tag => `<button class="tag-chip ${currentTag === tag ? 'selected' : ''}" onclick="filterByTag(event,'${escapeJs(tag)}')">#${escapeHtml(tag)}</button>`).join('')}${currentTag ? '<button class="tag-clear" onclick="clearTag(event)">× Effacer</button>' : ''}` : '';
}
function filterByTag(event, tag) { event.stopPropagation(); currentTag = currentTag === tag ? '' : tag; renderList(); }
function clearTag(event) { event.stopPropagation(); currentTag = ''; renderList(); }
function setSort(sort) { currentSort = sort; document.getElementById('sortMenu')?.classList.remove('show'); renderList(); }
function openSortMenu(event) { event.stopPropagation(); document.getElementById('sortMenu')?.classList.toggle('show'); }
function clearSearch() { document.getElementById('searchInput').value = ''; searchQuery = ''; renderList(); }
function handleSearch() { searchQuery = document.getElementById('searchInput').value.toLowerCase().trim(); renderList(); }

function openModal(index = null) {
    currentEditIndex = index; pendingAttachments = [];
    const modal = document.getElementById('noteModal');
    const heading = document.getElementById('modalTitleHeading');
    document.getElementById('modalDeleteBtn').style.display = index === null ? 'none' : 'block';
    if (index !== null) {
        const note = notesData[index]; heading.textContent = 'Modifier la note';
        document.getElementById('modalEmail').value = note.email || '';
        document.getElementById('modalDatetime').value = note.datetime || '';
        document.getElementById('modalDesc').value = note.desc || '';
        document.getElementById('modalStatus').value = normalizeStatus(note);
        document.getElementById('modalCategory').value = note.categoryId || 'general';
        document.getElementById('modalTags').value = (note.tags || []).join(', ');
        currentNoteColor = note.color || 'default'; currentAlarmEnabled = Boolean(note.alarmEnabled);
        updateFlagButtons(note); renderColorPicker(); loadAttachments(note.id);
    } else {
        heading.textContent = 'Nouvelle note';
        ['modalEmail','modalDatetime','modalDesc','modalTags'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('modalStatus').value = 'not_started'; document.getElementById('modalCategory').value = currentCategory !== 'all' ? currentCategory : 'general';
        currentNoteColor = 'default'; currentAlarmEnabled = false; updateFlagButtons({ favorite:false, pinned:false }); renderColorPicker(); renderAttachmentList([]);
    }
    updateAlarmButtonUI(); modal.classList.add('active');
}
function closeModal() { document.getElementById('noteModal').classList.remove('active'); currentEditIndex = null; pendingAttachments = []; }
function toggleNoteFlag(flag) { if (currentEditIndex === null) { const el = document.getElementById(flag === 'favorite' ? 'favoriteBtn' : 'pinnedBtn'); el.dataset.pending = el.dataset.pending !== 'true'; updateFlagButtons({ favorite: el.dataset.pending === 'true', pinned: document.getElementById('pinnedBtn').dataset.pending === 'true' }); return; } const note = notesData[currentEditIndex]; note[flag] = !note[flag]; updateFlagButtons(note); }
function updateFlagButtons(note) { ['favorite','pinned'].forEach(flag => { const btn = document.getElementById(flag === 'favorite' ? 'favoriteBtn' : 'pinnedBtn'); if (!btn) return; const active = Boolean(note[flag]); btn.classList.toggle('selected', active); btn.innerHTML = `${flag === 'favorite' ? (active ? '★' : '☆') : '📌'} <span>${flag === 'favorite' ? 'Favori' : 'Épingler'}</span>`; btn.dataset.pending = active ? 'true' : 'false'; }); }
function renderColorPicker() { const picker = document.getElementById('colorPicker'); if (!picker) return; picker.innerHTML = COLORS.map(c => `<button type="button" class="color-dot color-${c} ${currentNoteColor === c ? 'selected' : ''}" onclick="selectNoteColor('${c}')" aria-label="Couleur ${c}"></button>`).join(''); }
function selectNoteColor(color) { currentNoteColor = color; renderColorPicker(); }
function toggleModalAlarm() { currentAlarmEnabled = !currentAlarmEnabled; updateAlarmButtonUI(); }
function updateAlarmButtonUI() { const btn = document.getElementById('modalAlarmBtn'); if (!btn) return; btn.textContent = currentAlarmEnabled ? '🔕 Désactiver l’alarme' : '🔔 Activer l’alarme'; btn.className = `modal-alarm-btn ${currentAlarmEnabled ? 'btn-danger' : 'btn-success'}`; }

async function saveCurrentNote() {
    const email = document.getElementById('modalEmail').value.trim();
    const datetime = document.getElementById('modalDatetime').value;
    const desc = document.getElementById('modalDesc').value;
    const status = document.getElementById('modalStatus').value;
    const categoryId = document.getElementById('modalCategory').value || 'general';
    const tags = [...new Set(document.getElementById('modalTags').value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean))];
    if (currentEditIndex !== null) {
        const note = notesData[currentEditIndex];
        if (note.datetime !== datetime) note.triggered = false;
        note.email = email; note.datetime = datetime; note.desc = desc; note.status = status; note.checked = status === 'done'; note.alarmEnabled = currentAlarmEnabled; note.categoryId = categoryId; note.tags = tags; note.color = currentNoteColor; note.favorite = document.getElementById('favoriteBtn').dataset.pending === 'true'; note.pinned = document.getElementById('pinnedBtn').dataset.pending === 'true'; note.updatedAt = Date.now();
    } else {
        const note = { id: createNoteId(), checked: status === 'done', email, datetime, desc, triggered:false, alarmEnabled:currentAlarmEnabled, status, categoryId, tags, color:currentNoteColor, favorite:document.getElementById('favoriteBtn').dataset.pending === 'true', pinned:document.getElementById('pinnedBtn').dataset.pending === 'true', updatedAt:Date.now() };
        notesData.push(note); currentEditIndex = notesData.length - 1;
    }
    const noteId = notesData[currentEditIndex].id;
    await savePendingAttachments(noteId); saveData(); renderList(); closeModal(); showToast('Note enregistrée');
}

async function deleteCurrentNote() {
    if (currentEditIndex !== null && confirm('Voulez-vous vraiment supprimer cette note ?')) {
        const noteId = notesData[currentEditIndex].id; await deleteAttachmentsForNote(noteId); notesData.splice(currentEditIndex, 1); saveData(); renderList(); closeModal(); showToast('Note supprimée');
    }
}

function checkAlarms() {
    const now = new Date();
    const nowFormatted = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    let updated = false;
    notesData.forEach((note, index) => {
        if (note.alarmEnabled && note.datetime && note.datetime <= nowFormatted && !note.triggered && normalizeStatus(note) !== 'done') {
            note.triggered = true; updated = true; activeAlarmNoteIndex = index;
            const audio = document.getElementById('alarmAudio'); if (audioPermissionGranted) audio.play().catch(() => {});
            if ('Notification' in window && Notification.permission === 'granted') new Notification('⏰ Rappel d’alarme !', { body: note.desc || note.email || 'L’heure programmée est atteinte.', icon:'icon-192.png' });
            triggerAlarmOverlay(note);
        }
    });
    if (updated) { saveData(); renderList(); }
}
function triggerAlarmOverlay(note) { document.getElementById('alarmAlertInfo').innerHTML = `<b>${escapeHtml(note.email || 'Sans titre')}</b><br>${escapeHtml(note.desc || 'Aucune description').replace(/\n/g,'<br>')}`; document.getElementById('alarmOverlay').classList.add('active'); }
function stopActiveAlarm() { const audio=document.getElementById('alarmAudio'); audio.pause(); audio.currentTime=0; document.getElementById('alarmOverlay').classList.remove('active'); if(activeAlarmNoteIndex!==null && notesData[activeAlarmNoteIndex]) { notesData[activeAlarmNoteIndex].alarmEnabled=false; notesData[activeAlarmNoteIndex].updatedAt=Date.now(); saveData(); renderList(); } activeAlarmNoteIndex=null; }
function snoozeActiveAlarm(minutes) { const audio=document.getElementById('alarmAudio'); audio.pause(); audio.currentTime=0; document.getElementById('alarmOverlay').classList.remove('active'); if(activeAlarmNoteIndex!==null && notesData[activeAlarmNoteIndex]) { const n=notesData[activeAlarmNoteIndex], d=new Date(Date.now()+minutes*60000); n.datetime=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; n.triggered=false; n.alarmEnabled=true; n.updatedAt=Date.now(); saveData(); renderList(); } activeAlarmNoteIndex=null; }

function openAttachmentDB() { if (attachmentDBPromise) return attachmentDBPromise; attachmentDBPromise = new Promise((resolve,reject)=>{ const req=indexedDB.open(ATTACHMENT_DB_NAME,1); req.onupgradeneeded=e=>{ if(!e.target.result.objectStoreNames.contains(ATTACHMENT_STORE)){ const store=e.target.result.createObjectStore(ATTACHMENT_STORE,{keyPath:'id'}); store.createIndex('noteId','noteId',{unique:false}); } }; req.onsuccess=e=>resolve(e.target.result); req.onerror=()=>reject(req.error); }); return attachmentDBPromise; }
function addAttachment(event) { const file=event.target.files[0]; event.target.value=''; if(!file)return; const ext=file.name.split('.').pop().toLowerCase(); if(!ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext)){showToast('Format non autorisé');return;} pendingAttachments.push({id:createNoteId(),name:file.name,type:file.type,size:file.size,blob:file}); renderAttachmentList(pendingAttachments); }
function renderPendingAttachments() { renderAttachmentList(pendingAttachments); }
function renderAttachmentList(items=[]) { const box=document.getElementById('attachmentList'); if(!box)return; if(!items.length){box.innerHTML='<span class="empty-attachments">Aucune pièce jointe</span>';return;} box.innerHTML=items.map(a=>`<div class="attachment-item"><span>📎</span><span class="attachment-name">${escapeHtml(a.name)}</span><button class="attachment-action" onclick="openPendingAttachment(event,'${escapeJs(a.id)}')">↗</button><button class="attachment-action delete" onclick="removePendingAttachment(event,'${escapeJs(a.id)}')">×</button></div>`).join(''); }
function removePendingAttachment(event,id){event.stopPropagation();pendingAttachments=pendingAttachments.filter(a=>a.id!==id);renderPendingAttachments();}
function openPendingAttachment(event,id){event.stopPropagation();const a=pendingAttachments.find(x=>x.id===id);if(a)openBlob(a.blob,a.name);}
async function savePendingAttachments(noteId){if(!pendingAttachments.length)return;const db=await openAttachmentDB();await new Promise((resolve,reject)=>{const tx=db.transaction(ATTACHMENT_STORE,'readwrite');pendingAttachments.forEach(a=>tx.objectStore(ATTACHMENT_STORE).put({...a,noteId}));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});pendingAttachments=[];}
async function loadAttachments(noteId){try{const db=await openAttachmentDB();const rows=await new Promise((resolve,reject)=>{const tx=db.transaction(ATTACHMENT_STORE,'readonly');const req=tx.objectStore(ATTACHMENT_STORE).index('noteId').getAll(noteId);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});renderAttachmentList(rows);}catch(e){renderAttachmentList([]);}}
async function deleteAttachmentsForNote(noteId){try{const db=await openAttachmentDB();const rows=await new Promise((resolve,reject)=>{const tx=db.transaction(ATTACHMENT_STORE,'readonly');const req=tx.objectStore(ATTACHMENT_STORE).index('noteId').getAll(noteId);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});await new Promise((resolve,reject)=>{const tx=db.transaction(ATTACHMENT_STORE,'readwrite');rows.forEach(a=>tx.objectStore(ATTACHMENT_STORE).delete(a.id));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}catch(e){console.warn(e);}}
function openAttachment(attachment){openBlob(attachment.blob,attachment.name);}
function openBlob(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.target='_blank';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function removeAttachment(event,id,noteId){event.stopPropagation();openAttachmentDB().then(db=>new Promise((resolve,reject)=>{const tx=db.transaction(ATTACHMENT_STORE,'readwrite');tx.objectStore(ATTACHMENT_STORE).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);})).then(()=>loadAttachments(noteId));}

function setCustomAudio(event){const file=event.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=e=>{localStorage.setItem('pwa_custom_audio',e.target.result);document.getElementById('alarmAudio').src=e.target.result;showToast('Son personnalisé chargé');};reader.readAsDataURL(file);}
function exportJSON(){const payload={version:2,exportedAt:new Date().toISOString(),categories:categoriesData,notes:notesData};downloadText('notes_alarmes_export.json','data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(payload,null,2)));}
function exportCSV(){let csv='Titre,Date,Description,Statut,Dossier,Favori,Épinglée,Tags,Couleur,Alarme\r\n';notesData.forEach(n=>{const c=categoriesData.find(x=>x.id===n.categoryId);csv+=[n.email,n.datetime,n.desc,normalizeStatus(n),c?.name||'Général',n.favorite,n.pinned,(n.tags||[]).join('|'),n.color,n.alarmEnabled].map(csvCell).join(',')+'\r\n';});downloadText('notes_alarmes_export.csv','data:text/csv;charset=utf-8,'+encodeURIComponent(csv));}
function csvCell(v){return `"${String(v??'').replace(/"/g,'""')}"`;}
function downloadText(name,href){const a=document.createElement('a');a.href=href;a.download=name;document.body.appendChild(a);a.click();a.remove();}
function importData(event){const file=event.target.files[0];event.target.value='';if(!file)return;const reader=new FileReader();reader.onload=e=>{try{const raw=JSON.parse(e.target.result);const imported=Array.isArray(raw)?raw:raw.notes;notesData=Array.isArray(imported)?imported.map(normalizeNote):[];if(Array.isArray(raw.categories)){categoriesData=raw.categories;normalizeCategories();}saveData();renderList();showToast('Import terminé');}catch(err){alert('Erreur lors de la lecture du fichier JSON.');}};reader.readAsText(file);}

function formatDate(value){try{return new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(value));}catch{return value.replace('T',' à ');}}
function escapeHtml(value){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function escapeJs(value){return String(value).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n').replace(/\r/g,'\\r');}
function showToast(message){const box=document.getElementById('toastContainer');if(!box)return;const toast=document.createElement('div');toast.className='toast';toast.textContent=message;box.appendChild(toast);requestAnimationFrame(()=>toast.classList.add('show'));setTimeout(()=>{toast.classList.remove('show');setTimeout(()=>toast.remove(),220);},2200);}

document.addEventListener('DOMContentLoaded',()=>{loadData();renderList();setInterval(checkAlarms,5000);document.addEventListener('click',event=>{if(!event.target.closest('.content-tools'))document.getElementById('sortMenu')?.classList.remove('show');if(event.target===document.getElementById('noteModal'))closeModal();});});
