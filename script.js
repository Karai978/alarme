let audioPermissionGranted = false;
let notesData = [];
let currentEditIndex = null; 
let currentAlarmEnabled = false;
let currentFilter = 'all';
let searchQuery = '';
let activeAlarmNoteIndex = null;

function enableAudio() {
    const audio = document.getElementById("alarmAudio");
    audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
        audioPermissionGranted = true;
        alert("✨ Sonneries activées avec succès !");
    }).catch(err => console.error("Erreur audio:", err));

    if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadData();
    renderList();
    setInterval(checkAlarms, 5000);
});

function loadData() {
    const saved = localStorage.getItem("pwa_notes_data");
    if (saved) {
        try {
            notesData = JSON.parse(saved);
        } catch (e) {
            notesData = [];
        }
    }
    if (notesData.length === 0) {
        notesData = [{ checked: false, email: 'exemple@domaine.com', datetime: '', desc: 'Première note', triggered: false, alarmEnabled: false }];
        saveData();
    }
    
    // Charger le son personnalisé si existant
    const savedAudio = localStorage.getItem("pwa_custom_audio");
    if (savedAudio) {
        document.getElementById("alarmAudio").src = savedAudio;
    }
}

function saveData() {
    localStorage.setItem("pwa_notes_data", JSON.stringify(notesData));
}

// Tri automatique par date/heure urgente
function sortNotes() {
    notesData.sort((a, b) => {
        if (!a.datetime) return 1;
        if (!b.datetime) return -1;
        return new Date(a.datetime) - new Date(b.datetime);
    });
}

function renderList() {
    sortNotes();
    const listContainer = document.getElementById("emailList");
    listContainer.innerHTML = "";

    // Filtrage et recherche
    const filtered = notesData.filter((note, index) => {
        const matchesSearch = (note.email || '').toLowerCase().includes(searchQuery) || 
                              (note.desc || '').toLowerCase().includes(searchQuery);
        if (!matchesSearch) return false;

        if (currentFilter === 'pending') return !note.checked;
        if (currentFilter === 'completed') return note.checked;
        if (currentFilter === 'active-alarm') return note.alarmEnabled && !note.checked;
        return true;
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = `<div style="text-align:center; color:var(--text-secondary); padding:20px;">Aucune note trouvée.</div>`;
        return;
    }

    filtered.forEach((note) => {
        const originalIndex = notesData.indexOf(note);
        const item = document.createElement("div");
        item.className = "email-item";
        if (note.triggered && note.alarmEnabled) {
            item.classList.add("triggered");
        }

        const displayEmail = note.email ? note.email : "(Sans adresse mail)";
        const displayDesc = note.desc ? note.desc : "Aucune description";
        const displayTime = note.datetime ? note.datetime.replace('T', ' à ') : "Pas d'alarme";
        const alarmIcon = note.alarmEnabled ? "🔔 Activée" : "🔕 Désactivée";
        const statusText = note.checked ? "✅ Terminée" : "⏳ En cours";

        item.innerHTML = `
            <div class="email-info">
                <span class="email-text">${displayEmail}</span>
                <span class="email-meta">${displayDesc} — 🕒 ${displayTime} | ${alarmIcon} | ${statusText}</span>
            </div>
            <span style="color: var(--text-secondary); font-size: 1.2rem;">›</span>
        `;

        item.onclick = () => openModal(originalIndex);
        listContainer.appendChild(item);
    });
}

function handleSearch() {
    searchQuery = document.getElementById("searchInput").value.toLowerCase();
    renderList();
}

function setFilter(filter, btnElement) {
    currentFilter = filter;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
    renderList();
}

function openModal(index = null) {
    currentEditIndex = index;
    const modal = document.getElementById("noteModal");
    const heading = document.getElementById("modalTitleHeading");
    const deleteBtn = document.getElementById("modalDeleteBtn");

    if (index !== null) {
        heading.textContent = "Modifier la note";
        deleteBtn.style.display = "block";
        const note = notesData[index];
        document.getElementById("modalEmail").value = note.email || '';
        document.getElementById("modalDatetime").value = note.datetime || '';
        document.getElementById("modalDesc").value = note.desc || '';
        document.getElementById("modalChecked").checked = note.checked || false;
        currentAlarmEnabled = note.alarmEnabled || false;
    } else {
        heading.textContent = "Nouvelle note";
        deleteBtn.style.display = "none";
        document.getElementById("modalEmail").value = '';
        document.getElementById("modalDatetime").value = '';
        document.getElementById("modalDesc").value = '';
        document.getElementById("modalChecked").checked = false;
        currentAlarmEnabled = false;
    }

    updateAlarmButtonUI();
    modal.classList.add("active");
}

function toggleModalAlarm() {
    currentAlarmEnabled = !currentAlarmEnabled;
    updateAlarmButtonUI();
}

function updateAlarmButtonUI() {
    const btn = document.getElementById("modalAlarmBtn");
    if (currentAlarmEnabled) {
        btn.textContent = "🔕 Désactiver l'alarme";
        btn.className = "modal-alarm-btn btn-danger";
    } else {
        btn.textContent = "🔔 Activer l'alarme";
        btn.className = "modal-alarm-btn btn-success";
    }
}

function closeModal() {
    document.getElementById("noteModal").classList.remove("active");
    currentEditIndex = null;
}

function saveCurrentNote() {
    const email = document.getElementById("modalEmail").value;
    const datetime = document.getElementById("modalDatetime").value;
    const desc = document.getElementById("modalDesc").value;
    const checked = document.getElementById("modalChecked").checked;

    if (currentEditIndex !== null) {
        if (notesData[currentEditIndex].datetime !== datetime) {
            notesData[currentEditIndex].triggered = false;
        }
        notesData[currentEditIndex] = { 
            ...notesData[currentEditIndex], 
            email, 
            datetime, 
            desc, 
            checked, 
            alarmEnabled: currentAlarmEnabled 
        };
    } else {
        notesData.push({ 
            checked, 
            email, 
            datetime, 
            desc, 
            triggered: false, 
            alarmEnabled: currentAlarmEnabled 
        });
    }

    saveData();
    renderList();
    closeModal();
}

function deleteCurrentNote() {
    if (currentEditIndex !== null) {
        if (confirm("Voulez-vous vraiment supprimer cette note ?")) {
            notesData.splice(currentEditIndex, 1);
            saveData();
            renderList();
            closeModal();
        }
    }
}

// Gestion active de l'alarme (Snooze & Stop)
function checkAlarms() {
    const now = new Date();
    const nowFormatted = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0') + 'T' +
        String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0');

    let updated = false;

    notesData.forEach((note, index) => {
        if (note.alarmEnabled && note.datetime && note.datetime <= nowFormatted && !note.triggered) {
            note.triggered = true;
            updated = true;
            activeAlarmNoteIndex = index;

            if (audioPermissionGranted) {
                const audio = document.getElementById("alarmAudio");
                audio.play().catch(e => console.log(e));
            }

            if ("Notification" in window && Notification.permission === "granted") {
                new Notification("⏰ Rappel d'alarme !", {
                    body: note.desc || note.email || "L'heure programmée est atteinte.",
                    icon: "icon-192.png"
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
    const overlay = document.getElementById("alarmOverlay");
    document.getElementById("alarmAlertInfo").innerHTML = `<b>${note.email || 'Sans e-mail'}</b><br>${note.desc || 'Aucune description'}`;
    overlay.classList.add("active");
}

function stopActiveAlarm() {
    const audio = document.getElementById("alarmAudio");
    audio.pause();
    audio.currentTime = 0;
    document.getElementById("alarmOverlay").classList.remove("active");
    if (activeAlarmNoteIndex !== null) {
        notesData[activeAlarmNoteIndex].alarmEnabled = false; // Désactiver l'alarme après arrêt
        saveData();
        renderList();
    }
    activeAlarmNoteIndex = null;
}

function snoozeActiveAlarm(minutes) {
    const audio = document.getElementById("alarmAudio");
    audio.pause();
    audio.currentTime = 0;
    document.getElementById("alarmOverlay").classList.remove("active");

    if (activeAlarmNoteIndex !== null) {
        const targetNote = notesData[activeAlarmNoteIndex];
        const newTime = new Date(Date.now() + minutes * 60000);
        targetNote.datetime = newTime.getFullYear() + '-' +
            String(newTime.getMonth() + 1).padStart(2, '0') + '-' +
            String(newTime.getDate()).padStart(2, '0') + 'T' +
            String(newTime.getHours()).padStart(2, '0') + ':' +
            String(newTime.getMinutes()).padStart(2, '0');
        targetNote.triggered = false;
        saveData();
        renderList();
    }
    activeAlarmNoteIndex = null;
}

// Choix du son personnalisé
function setCustomAudio(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64Audio = e.target.result;
            localStorage.setItem("pwa_custom_audio", base64Audio);
            document.getElementById("alarmAudio").src = base64Audio;
            alert("🎵 Son personnalisé chargé avec succès !");
        };
        reader.readAsDataURL(file);
    }
}

// Export JSON & CSV
function exportJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(notesData, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", "notes_alarmes_export.json");
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
}

function exportCSV() {
    let csvContent = "data:text/csv;charset=utf-8,Email,Datetime,Description,Checked,AlarmEnabled\r\n";
    notesData.forEach(note => {
        const row = [
            `"${note.email || ''}"`,
            `"${note.datetime || ''}"`,
            `"${note.desc || ''}"`,
            note.checked,
            note.alarmEnabled
        ].join(",");
        csvContent += row + "\r\n";
    });
    const encodedUri = encodeURI(csvContent);
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", encodedUri);
    dlAnchor.setAttribute("download", "notes_alarmes_export.csv");
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
}

// Importation/Restauration
function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        if (file.name.endsWith('.json')) {
            try {
                notesData = JSON.parse(content);
                saveData();
                renderList();
                alert("📂 Données JSON importées avec succès !");
            } catch (err) {
                alert("Erreur lors de la lecture du fichier JSON.");
            }
        } else if (file.name.endsWith('.csv')) {
            try {
                const lines = content.split('\r\n').filter(l => l.trim() !== '');
                const newNotes = [];
                for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                    if (cols.length >= 5) {
                        newNotes.push({
                            email: cols[0].replace(/"/g, ''),
                            datetime: cols[1].replace(/"/g, ''),
                            desc: cols[2].replace(/"/g, ''),
                            checked: cols[3] === 'true',
                            alarmEnabled: cols[4] === 'true',
                            triggered: false
                        });
                    }
                }
                if (newNotes.length > 0) {
                    notesData = newNotes;
                    saveData();
                    renderList();
                    alert("📂 Données CSV importées avec succès !");
                }
            } catch (err) {
                alert("Erreur lors de la lecture du fichier CSV.");
            }
        }
    };
    reader.readAsText(file);
}

// Mode Sombre / Clair (Toggle)
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", newTheme);
    localStorage.setItem("pwa_theme", newTheme);
}

// Charger le thème enregistré au démarrage
document.addEventListener("DOMContentLoaded", () => {
    const savedTheme = localStorage.getItem("pwa_theme");
    if (savedTheme) {
        document.documentElement.setAttribute("data-theme", savedTheme);
    }
});