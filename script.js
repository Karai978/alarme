let audioPermissionGranted = false;
let notesData = [];
let currentEditIndex = null;
let currentAlarmEnabled = false;
let currentFilter = 'todo';
let searchQuery = '';
let activeAlarmNoteIndex = null;
let pendingAttachments = [];

const ATTACHMENT_DB_NAME = 'notes_alarme_attachments_v1';
const ATTACHMENT_STORE = 'attachments';
const ALLOWED_ATTACHMENT_EXTENSIONS = ['md', 'txt', 'json'];

function createNoteId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }
    return 'note-' + Date.now() + '-' + Math.random().toString(36).slice(2);
}

function normalizeStatus(note) {
    if (note.status === 'done' || note.status === 'waiting' || note.status === 'not_started') {
        return note.status;
    }
    return note.checked ? 'done' : 'not_started';
}

function normalizeNote(note) {
    const normalized = {
        id: note.id || createNoteId(),
        checked: Boolean(note.checked),
        email: note.email || '',
        datetime: note.datetime || '',
        desc: note.desc || '',
        triggered: Boolean(note.triggered),
        alarmEnabled: Boolean(note.alarmEnabled),
        status: normalizeStatus(note)
    };
    normalized.checked = normalized.status === 'done';
    return normalized;
}

function normalizeAllNotes() {
    notesData = Array.isArray(notesData) ? notesData.map(normalizeNote) : [];
}

function enableAudio() {
    const audio = document.getElementById('alarmAudio');
    audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
        audioPermissionGranted = true;
        alert('✨ Sonneries activées avec succès !');
    }).catch(err => console.error('Erreur audio:', err));

    if ('Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    renderList();
    setInterval(checkAlarms, 5000);

    window.onclick = function(event) {
        if (!event.target.matches('.dropdown-btn')) {
            const dropdowns = document.getElementsByClassName('dropdown-content');
            for (let i = 0; i < dropdowns.length; i++) {
                dropdowns[i].classList.remove('show');
            }
        }
    };
});

function toggleDropdown(event, dropdownId) {
    event.stopPropagation();
    const dropdowns = document.getElementsByClassName('dropdown-content');
    for (let i = 0; i < dropdowns.length; i++) {
        if (dropdowns[i].id !== dropdownId) dropdowns[i].classList.remove('show');
    }
    document.getElementById(dropdownId).classList.toggle('show');
}

function setFilter(filter, labelText) {
    currentFilter = filter;
    document.getElementById('filterDropdownBtn').textContent = `📌 ${labelText} ▾`;
    document.getElementById('filterDropdown').classList.remove('show');
    renderList();
}

function loadData() {
    const saved = localStorage.getItem('pwa_notes_data');
    if (saved) {
        try {
            notesData = JSON.parse(saved);
            normalizeAllNotes();
        } catch (e) {
            notesData = [];
        }
    } else {
        notesData = [{
            id: createNoteId(),
            checked: false,
            email: 'exemple@domaine.com',
            datetime: '',
            desc: 'Première note',
            triggered: false,
            alarmEnabled: false,
            status: 'not_started'
        }];
        saveData();
    }

    const savedAudio = localStorage.getItem('pwa_custom_audio');
    if (savedAudio) document.getElementById('alarmAudio').src = savedAudio;
}

function saveData() {
    localStorage.setItem('pwa_notes_data', JSON.stringify(notesData));
}

function sortNotes() {
    notesData.sort((a, b) => {
        if (!a.datetime) return 1;
        if (!b.datetime) return -1;
        return new Date(a.datetime) - new Date(b.datetime);
    });
}

function getStatusInfo(note) {
    const status = normalizeStatus(note);
    if (status === 'done') return { icon: '✓', label: 'Terminé', className: 'done' };
    if (status === 'waiting') return { icon: '⏳', label: 'En attente', className: 'waiting' };
    return { icon: '○', label: 'Pas démarré', className: 'not-started' };
}

function renderList() {
    sortNotes();
    const listContainer = document.getElementById('emailList');
    listContainer.innerHTML = '';

    const filtered = notesData.filter(note => {
        const haystack = `${note.email || ''} ${note.desc || ''}`.toLowerCase();
        if (!haystack.includes(searchQuery)) return false;

        const status = normalizeStatus(note);
        if (currentFilter === 'todo') return status !== 'done';
        if (currentFilter === 'not_started') return status === 'not_started';
        if (currentFilter === 'waiting') return status === 'waiting';
        if (currentFilter === 'done') return status === 'done';
        return true;
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = '<div class="empty-list">Aucune note trouvée.</div>';
        return;
    }

    filtered.forEach(note => {
        const originalIndex = notesData.indexOf(note);
        const item = document.createElement('div');
        item.className = 'email-item';
        if (note.triggered && note.alarmEnabled) item.classList.add('triggered');

        const status = getStatusInfo(note);
        const displayEmail = note.email ? note.email : 'Note sans adresse mail';
        const displayDesc = note.desc ? note.desc : 'Aucune description';
        const displayTime = note.datetime ? note.datetime.replace('T', ' à ') : 'Pas d’alarme';
        const alarmIcon = note.alarmEnabled ? '🔔' : '🔕';

        item.innerHTML = `
            <div class="email-info">
                <div class="email-title-row">${escapeHtml(displayEmail)}</div>
                <div class="email-details-group">
                    <div class="detail-line description-preview">📝 ${escapeHtml(displayDesc)}</div>
                    <div class="detail-line">🕒 ${escapeHtml(displayTime)}</div>
                    <div class="detail-line">${alarmIcon} ${note.alarmEnabled ? 'Alarme activée' : 'Alarme désactivée'}</div>
                </div>
            </div>
            <span class="status-icon ${status.className}" title="${status.label}" aria-label="${status.label}">${status.icon}</span>
        `;

        item.onclick = () => openModal(originalIndex);
        listContainer.appendChild(item);
    });
}

function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[char]));
}

function handleSearch() {
    searchQuery = document.getElementById('searchInput').value.toLowerCase().trim();
    renderList();
}

function openModal(index = null) {
    currentEditIndex = index;
    pendingAttachments = [];

    const modal = document.getElementById('noteModal');
    const heading = document.getElementById('modalTitleHeading');
    const deleteBtn = document.getElementById('modalDeleteBtn');

    if (index !== null) {
        heading.textContent = 'Modifier la note';
        deleteBtn.style.display = 'block';
        const note = notesData[index];
        document.getElementById('modalEmail').value = note.email || '';
        document.getElementById('modalDatetime').value = note.datetime || '';
        document.getElementById('modalDesc').value = note.desc || '';
        document.getElementById('modalStatus').value = normalizeStatus(note);
        currentAlarmEnabled = note.alarmEnabled || false;
        loadAttachments(note.id);
    } else {
        heading.textContent = 'Nouvelle note';
        deleteBtn.style.display = 'none';
        document.getElementById('modalEmail').value = '';
        document.getElementById('modalDatetime').value = '';
        document.getElementById('modalDesc').value = '';
        document.getElementById('modalStatus').value = 'not_started';
        currentAlarmEnabled = false;
        renderAttachmentList([]);
    }

    updateAlarmButtonUI();
    modal.classList.add('active');
}

function toggleModalAlarm() {
    currentAlarmEnabled = !currentAlarmEnabled;
    updateAlarmButtonUI();
}

function updateAlarmButtonUI() {
    const btn = document.getElementById('modalAlarmBtn');
    if (currentAlarmEnabled) {
        btn.textContent = '🔕 Désactiver l’alarme';
        btn.className = 'modal-alarm-btn btn-danger';
    } else {
        btn.textContent = '🔔 Activer l’alarme';
        btn.className = 'modal-alarm-btn btn-success';
    }
}

function closeModal() {
    document.getElementById('noteModal').classList.remove('active');
    currentEditIndex = null;
    pendingAttachments = [];
}

async function saveCurrentNote() {
    const email = document.getElementById('modalEmail').value.trim();
    const datetime = document.getElementById('modalDatetime').value;
    const desc = document.getElementById('modalDesc').value;
    const status = document.getElementById('modalStatus').value;
    const checked = status === 'done';

    if (currentEditIndex !== null) {
        const note = notesData[currentEditIndex];
        if (note.datetime !== datetime) note.triggered = false;
        notesData[currentEditIndex] = {
            ...note,
            email,
            datetime,
            desc,
            checked,
            status,
            alarmEnabled: currentAlarmEnabled
        };
    } else {
        notesData.push({
            id: createNoteId(),
            checked,
            email,
            datetime,
            desc,
            triggered: false,
            alarmEnabled: currentAlarmEnabled,
            status
        });
        currentEditIndex = notesData.length - 1;
    }

    const noteId = notesData[currentEditIndex].id;
    await savePendingAttachments(noteId);
    saveData();
    renderList();
    closeModal();
}

async function deleteCurrentNote() {
    if (currentEditIndex !== null && confirm('Voulez-vous vraiment supprimer cette note ?')) {
        const noteId = notesData[currentEditIndex].id;
        await deleteAttachmentsForNote(noteId);
        notesData.splice(currentEditIndex, 1);
        saveData();
        renderList();
        closeModal();
    }
}

function checkAlarms() {
    const now = new Date();
    const nowFormatted = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0') + 'T' +
        String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0');

    let updated = false;
    notesData.forEach((note, index) => {
        if (note.alarmEnabled && note.datetime && note.datetime <= nowFormatted && !note.triggered && normalizeStatus(note) !== 'done') {
            note.triggered = true;
            updated = true;
            activeAlarmNoteIndex = index;

            if (audioPermissionGranted) {
                const audio = document.getElementById('alarmAudio');
                audio.play().catch(e => console.log(e));
            }

            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('⏰ Rappel d’alarme !', {
                    body: note.desc || note.email || 'L’heure programmée est atteinte.',
                    icon: 'icon-192.png'
                });
            }
            triggerAlarmOverlay(note);
        }
    });

    if (updated) {
        saveData();
        renderList();
    }
}

function triggerAlarmOverlay(note) {
    const overlay = document.getElementById('alarmOverlay');
    document.getElementById('alarmAlertInfo').innerHTML = `<b>${escapeHtml(note.email || 'Sans e-mail')}</b><br>${escapeHtml(note.desc || 'Aucune description').replace(/\n/g, '<br>')}`;
    overlay.classList.add('active');
}

function stopActiveAlarm() {
    const audio = document.getElementById('alarmAudio');
    audio.pause();
    audio.currentTime = 0;
    document.getElementById('alarmOverlay').classList.remove('active');
    if (activeAlarmNoteIndex !== null && notesData[activeAlarmNoteIndex]) {
        notesData[activeAlarmNoteIndex].alarmEnabled = false;
        saveData();
        renderList();
    }
    activeAlarmNoteIndex = null;
}

function snoozeActiveAlarm(minutes) {
    const audio = document.getElementById('alarmAudio');
    audio.pause();
    audio.currentTime = 0;
    document.getElementById('alarmOverlay').classList.remove('active');

    if (activeAlarmNoteIndex !== null && notesData[activeAlarmNoteIndex]) {
        const targetNote = notesData[activeAlarmNoteIndex];
        const newTime = new Date(Date.now() + minutes * 60000);
        targetNote.datetime = newTime.getFullYear() + '-' +
            String(newTime.getMonth() + 1).padStart(2, '0') + '-' +
            String(newTime.getDate()).padStart(2, '0') + 'T' +
            String(newTime.getHours()).padStart(2, '0') + ':' +
            String(newTime.getMinutes()).padStart(2, '0');
        targetNote.triggered = false;
        targetNote.alarmEnabled = true;
        saveData();
        renderList();
    }
    activeAlarmNoteIndex = null;
}

function setCustomAudio(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        localStorage.setItem('pwa_custom_audio', e.target.result);
        document.getElementById('alarmAudio').src = e.target.result;
        alert('🎵 Son personnalisé chargé avec succès !');
    };
    reader.readAsDataURL(file);
}

function exportJSON() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(notesData, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.href = dataStr;
    dlAnchor.download = 'notes_alarmes_export.json';
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
}

function exportCSV() {
    let csvContent = 'data:text/csv;charset=utf-8,Email,Datetime,Description,Status,AlarmEnabled\r\n';
    notesData.forEach(note => {
        const row = [
            `"${String(note.email || '').replace(/"/g, '""')}"`,
            `"${String(note.datetime || '').replace(/"/g, '""')}"`,
            `"${String(note.desc || '').replace(/"/g, '""')}"`,
            `"${normalizeStatus(note)}"`,
            note.alarmEnabled
        ].join(',');
        csvContent += row + '\r\n';
    });
    const dlAnchor = document.createElement('a');
    dlAnchor.href = encodeURI(csvContent);
    dlAnchor.download = 'notes_alarmes_export.csv';
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        if (file.name.toLowerCase().endsWith('.json')) {
            try {
                notesData = JSON.parse(content);
                normalizeAllNotes();
                saveData();
                renderList();
                alert('📂 Données JSON importées avec succès !');
            } catch (err) {
                alert('Erreur lors de la lecture du fichier JSON.');
            }
        } else if (file.name.toLowerCase().endsWith('.csv')) {
            try {
                const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');
                const newNotes = [];
                for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                    if (cols.length >= 5) {
                        newNotes.push(normalizeNote({
                            email: cols[0].replace(/^"|"$/g, '').replace(/""/g, '"'),
                            datetime: cols[1].replace(/^"|"$/g, '').replace(/""/g, '"'),
                            desc: cols[2].replace(/^"|"$/g, '').replace(/""/g, '"'),
                            status: cols[3].replace(/^"|"$/g, ''),
                            alarmEnabled: cols[4].trim() === 'true',
                            triggered: false
                        }));
                    }
                }
                if (newNotes.length > 0) {
                    notesData = newNotes;
                    saveData();
                    renderList();
                    alert('📂 Données CSV importées avec succès !');
                }
            } catch (err) {
                alert('Erreur lors de la lecture du fichier CSV.');
            }
        }
        event.target.value = '';
    };
    reader.readAsText(file);
}

function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('pwa_theme', newTheme);
}

function openAttachmentDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(ATTACHMENT_DB_NAME, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(ATTACHMENT_STORE)) {
                const store = db.createObjectStore(ATTACHMENT_STORE, { keyPath: 'id' });
                store.createIndex('noteId', 'noteId', { unique: false });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function addAttachment(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;

    const extension = file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(extension)) {
        alert('Seuls les fichiers .md, .txt et .json sont autorisés.');
        return;
    }

    if (currentEditIndex === null) {
        pendingAttachments.push(file);
        renderPendingAttachments();
        return;
    }

    try {
        const noteId = notesData[currentEditIndex].id;
        const db = await openAttachmentDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(ATTACHMENT_STORE, 'readwrite');
            tx.objectStore(ATTACHMENT_STORE).put({
                id: createNoteId(),
                noteId,
                name: file.name,
                type: file.type || 'application/octet-stream',
                size: file.size,
                blob: file,
                createdAt: Date.now()
            });
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        db.close();
        loadAttachments(noteId);
    } catch (error) {
        console.error('Erreur pièce jointe:', error);
        alert('Impossible d’enregistrer la pièce jointe.');
    }
}

function renderPendingAttachments() {
    const list = document.getElementById('attachmentList');
    list.innerHTML = '';
    if (pendingAttachments.length === 0) {
        list.innerHTML = '<span class="empty-attachments">Aucune pièce jointe</span>';
        return;
    }
    pendingAttachments.forEach((file, index) => {
        const row = document.createElement('div');
        row.className = 'attachment-item';
        row.innerHTML = `<span class="attachment-name">📎 ${escapeHtml(file.name)}</span><button type="button" class="attachment-action delete" title="Retirer">×</button>`;
        row.querySelector('button').onclick = () => {
            pendingAttachments.splice(index, 1);
            renderPendingAttachments();
        };
        list.appendChild(row);
    });
}

async function savePendingAttachments(noteId) {
    if (pendingAttachments.length === 0) return;
    const db = await openAttachmentDB();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(ATTACHMENT_STORE, 'readwrite');
        const store = tx.objectStore(ATTACHMENT_STORE);
        pendingAttachments.forEach(file => store.put({
            id: createNoteId(),
            noteId,
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size,
            blob: file,
            createdAt: Date.now()
        }));
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

async function loadAttachments(noteId) {
    try {
        const db = await openAttachmentDB();
        const attachments = await new Promise((resolve, reject) => {
            const tx = db.transaction(ATTACHMENT_STORE, 'readonly');
            const request = tx.objectStore(ATTACHMENT_STORE).index('noteId').getAll(noteId);
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
        db.close();
        renderAttachmentList(attachments);
    } catch (error) {
        console.error('Erreur lecture pièces jointes:', error);
        renderAttachmentList([]);
    }
}

function renderAttachmentList(attachments) {
    const list = document.getElementById('attachmentList');
    list.innerHTML = '';
    if (!attachments.length) {
        list.innerHTML = '<span class="empty-attachments">Aucune pièce jointe</span>';
        return;
    }

    attachments.forEach(attachment => {
        const row = document.createElement('div');
        row.className = 'attachment-item';
        row.innerHTML = `
            <span class="attachment-name" title="${escapeHtml(attachment.name)}">📎 ${escapeHtml(attachment.name)}</span>
            <button type="button" class="attachment-action" title="Ouvrir / télécharger">↗</button>
            <button type="button" class="attachment-action delete" title="Supprimer">×</button>
        `;
        row.querySelectorAll('button')[0].onclick = () => openAttachment(attachment);
        row.querySelectorAll('button')[1].onclick = () => removeAttachment(attachment.id, attachment.noteId);
        list.appendChild(row);
    });
}

function openAttachment(attachment) {
    const url = URL.createObjectURL(attachment.blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = attachment.name;
    anchor.target = '_blank';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function removeAttachment(attachmentId, noteId) {
    try {
        const db = await openAttachmentDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(ATTACHMENT_STORE, 'readwrite');
            tx.objectStore(ATTACHMENT_STORE).delete(attachmentId);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        db.close();
        loadAttachments(noteId);
    } catch (error) {
        console.error('Erreur suppression pièce jointe:', error);
    }
}

async function deleteAttachmentsForNote(noteId) {
    if (!noteId) return;
    try {
        const db = await openAttachmentDB();
        const attachments = await new Promise((resolve, reject) => {
            const tx = db.transaction(ATTACHMENT_STORE, 'readonly');
            const request = tx.objectStore(ATTACHMENT_STORE).index('noteId').getAll(noteId);
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
        await new Promise((resolve, reject) => {
            const tx = db.transaction(ATTACHMENT_STORE, 'readwrite');
            const store = tx.objectStore(ATTACHMENT_STORE);
            attachments.forEach(attachment => store.delete(attachment.id));
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        db.close();
    } catch (error) {
        console.error('Erreur nettoyage pièces jointes:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('pwa_theme');
    if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
});
