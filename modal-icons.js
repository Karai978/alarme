const MODAL_ICONS = {
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.78 5.63 6.22.9-4.5 4.38 1.06 6.19L12 17.18l-5.56 2.92 1.06-6.19L3 9.53l6.22-.9L12 3Z"></path></svg>',
    starFilled: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.78 5.63 6.22.9-4.5 4.38 1.06 6.19L12 17.18l-5.56 2.92 1.06-6.19L3 9.53l6.22-.9L12 3Z" fill="currentColor" stroke="currentColor"></path></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17v5"></path><path d="m5 3 14 0"></path><path d="M7 3v6l-2 3h14l-2-3V3"></path></svg>',
    bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path></svg>',
    bellOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.73 21a2 2 0 0 1-3.46 0"></path><path d="M18.63 13A17.9 17.9 0 0 1 18 8"></path><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 7-3 9h14"></path><path d="M8.67 3.87A6 6 0 0 1 18 8c0 3.12.56 4.75 1.17 5.83"></path><path d="m2 2 20 20"></path></svg>',
    save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"></path><path d="M17 21v-8H7v8"></path><path d="M7 3v5h8"></path></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 15H6L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>'
};

function updateFlagButtons(note) {
    ['favorite', 'pinned'].forEach(flag => {
        const btn = document.getElementById(flag === 'favorite' ? 'favoriteBtn' : 'pinnedBtn');
        if (!btn) return;
        const active = Boolean(note[flag]);
        btn.classList.toggle('selected', active);
        btn.innerHTML = flag === 'favorite'
            ? (active ? MODAL_ICONS.starFilled : MODAL_ICONS.star)
            : MODAL_ICONS.pin;
        btn.dataset.pending = active ? 'true' : 'false';
        btn.setAttribute('aria-pressed', String(active));
        btn.title = flag === 'favorite'
            ? (active ? 'Retirer des favoris' : 'Ajouter aux favoris')
            : (active ? 'Retirer des épinglés' : 'Épingler la note');
    });
}

function updateAlarmButtonUI() {
    const btn = document.getElementById('modalAlarmBtn');
    if (!btn) return;
    btn.innerHTML = currentAlarmEnabled ? MODAL_ICONS.bellOff : MODAL_ICONS.bell;
    btn.className = `modal-alarm-btn modal-icon-action ${currentAlarmEnabled ? 'btn-danger' : 'btn-success'}`;
    btn.setAttribute('aria-label', currentAlarmEnabled ? 'Désactiver l’alarme' : 'Activer l’alarme');
    btn.title = currentAlarmEnabled ? 'Désactiver l’alarme' : 'Activer l’alarme';
}
