// ==========================================
// 1. FIREBASE INITIALISIERUNG
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCGzYuktvsFcmU5pnBtWzso_eFbTcG6oPQ",
  authDomain: "mdt-by-heimo.firebaseapp.com",
  projectId: "mdt-by-heimo",
  storageBucket: "mdt-by-heimo.firebasestorage.app",
  messagingSenderId: "539623345312",
  appId: "1:539623345312:web:9b142cfd0e3402972f4dc5"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Falls searchPerson fehlt:
async function searchPerson() {
    const term = document.getElementById('search-person-input').value.toLowerCase();
    const resultsDiv = document.getElementById('person-results');
    if (!resultsDiv) return;

    const snapshot = await db.collection('persons')
        .where('lastname', '>=', term)
        .where('lastname', '<=', term + '\uf8ff')
        .limit(10).get();

    resultsDiv.innerHTML = "";
    snapshot.forEach(doc => {
        const p = doc.data();
        resultsDiv.innerHTML += `
            <div class="card p-4 border-l-4 ${p.tags.includes('Wanted') ? 'border-red-600' : 'border-blue-600'}">
                <h4 class="font-bold">${p.firstname} ${p.lastname}</h4>
                <button onclick="exportToPDF('${doc.id}')" class="text-[10px] bg-slate-700 p-1 rounded mt-2">Export PDF</button>
            </div>`;
    });
}

// Falls openReportModal fehlt:
function openReportModal() {
    const modal = document.getElementById('modal-report');
    if (modal) modal.classList.remove('hidden');
}

// Universelle Funktion zum Schließen aller Modals
function closeModal() {
    // Liste aller Modal-IDs
    const modals = ['modal-person', 'modal-vehicle', 'modal-report'];
    
    modals.forEach(id => {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.add('hidden');
        }
    });
    
    // Optional: Formularfelder nach dem Schließen leeren
    selectedTags = []; 
    // Setzt die Optik der Tag-Buttons zurück
    document.querySelectorAll('.tag-btn').forEach(btn => {
        btn.style.backgroundColor = "";
        btn.style.color = "";
    });
}

// Hilfsfunktion zum Seitenwechsel
function showPage(pageId) {
    console.log("Wechsle zu Seite:", pageId);

    // 1. Alle Seiten ausblenden
    const pages = document.querySelectorAll('.page');
    pages.forEach(p => p.classList.add('hidden'));

    // 2. Zielseite finden und anzeigen
    const targetPage = document.getElementById('page-' + pageId);
    if (targetPage) {
        targetPage.classList.remove('hidden');
    } else {
        console.warn(`WARNUNG: Element mit ID 'page-${pageId}' wurde im HTML nicht gefunden!`);
        return; // Stoppe hier, um Folgefehler zu vermeiden
    }

    // 3. Daten laden (nur wenn die Funktionen auch wirklich existieren)
    if (pageId === 'reports' && typeof loadReports === 'function') {
        loadReports();
    } else if (pageId === 'reports') {
        console.error("Fehler: loadReports ist nicht definiert!");
    }

    if (pageId === 'employees' && typeof renderEmployeePanel === 'function') {
        renderEmployeePanel();
    } else if (pageId === 'employees') {
        console.error("Fehler: renderEmployeePanel ist nicht definiert!");
    }
    
    if (pageId === 'persons' && typeof searchPerson === 'function') {
        searchPerson();
    }
}



// ==========================================
// 2. GLOBALE VARIABLEN & AUTH
// ==========================================
let currentUser = null;
let selectedTags = [];

async function handleLogin() {
    const userVal = document.getElementById('login-user').value.trim();
    const passVal = document.getElementById('login-pass').value;

    if (!userVal || !passVal) return alert("Bitte Logindaten eingeben!");

    try {
        const userRef = db.collection('users').doc(userVal);
        const doc = await userRef.get();

        if (doc.exists && doc.data().password === passVal) {
            currentUser = doc.data();
            currentUser.username = doc.id;

            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('current-rank').innerText = `${currentUser.rank} | ${currentUser.department}`;
            
            // Initialisiere MDT Funktionen
            startWantedListener();
            checkPermissions();
            showPage('home');
        } else {
            alert("Benutzername oder Passwort falsch!");
        }
    } catch (error) {
        console.error("Login Fehler:", error);
    }
}

// ==========================================
// 3. NAVIGATION & RECHTE
// ==========================================
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById('page-' + pageId).classList.remove('hidden');
    
    if(pageId === 'reports') loadReports();
    if(pageId === 'employees') renderEmployeePanel();
}

function checkPermissions() {
    const rank = currentUser.rank;
    // Elemente basierend auf Rang verstecken/zeigen
    if (rank === "LSPD Officer" || rank === "Marshal Officer") {
        document.querySelectorAll('.high-clearance').forEach(el => el.classList.add('hidden'));
    }
}

// ==========================================
// 4. PERSONENREGISTER
// ==========================================
function toggleTag(btn) {
    const tag = btn.getAttribute('data-tag');
    if (selectedTags.includes(tag)) {
        selectedTags = selectedTags.filter(t => t !== tag);
        btn.classList.remove('bg-blue-600', 'text-white');
    } else {
        selectedTags.push(tag);
        btn.classList.add('bg-blue-600', 'text-white');
    }
}

async function savePerson() {
    const pData = {
        firstname: document.getElementById('p-firstname').value,
        lastname: document.getElementById('p-lastname').value,
        dob: document.getElementById('p-dob').value,
        tags: selectedTags,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const docId = `${pData.firstname}_${pData.lastname}`.toLowerCase();
    await db.collection('persons').doc(docId).set(pData, { merge: true });
    alert("Person gespeichert!");
    closeModal();
}

// ==========================================
// 5. FAHRZEUGREGISTER & BESITZER-LINK
// ==========================================
async function liveSearchOwner(query) {
    if (query.length < 2) return;
    const dropdown = document.getElementById('owner-dropdown');
    const snapshot = await db.collection('persons').where('lastname', '>=', query.toLowerCase()).limit(5).get();
    
    dropdown.innerHTML = "";
    snapshot.forEach(doc => {
        const p = doc.data();
        const div = document.createElement('div');
        div.className = "p-2 hover:bg-slate-600 cursor-pointer";
        div.innerText = `${p.firstname} ${p.lastname}`;
        div.onclick = () => {
            document.getElementById('v-owner-id').value = doc.id;
            document.getElementById('selected-owner-display').innerText = "Besitzer: " + p.firstname + " " + p.lastname;
            dropdown.classList.add('hidden');
        };
        dropdown.appendChild(div);
    });
    dropdown.classList.remove('hidden');
}

async function saveVehicle() {
    const plate = document.getElementById('v-plate').value.toUpperCase();
    const vData = {
        plate: plate,
        ownerId: document.getElementById('v-owner-id').value,
        model: document.getElementById('v-model').value
    };
    await db.collection('vehicles').doc(plate).set(vData);
    alert("Fahrzeug registriert!");
}

// ==========================================
// 6. EINSATZBERICHTE
// ==========================================
async function saveReport() {
    const prefix = currentUser.department.includes("MARSHAL") ? "LSMS" : "LSPD";
    const snapshot = await db.collection('reports').get();
    const reportId = `${prefix}-EINSATZ-${snapshot.size + 1000}`;

    const rData = {
        content: document.getElementById('r-content').value,
        author: currentUser.username,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('reports').doc(reportId).set(rData);
    alert("Bericht archiviert: " + reportId);
}

// ==========================================
// 7. LIVE WANTED LISTE (ECHTZEIT)
// ==========================================
function startWantedListener() {
    db.collection('persons').where('tags', 'array-contains', 'Wanted')
    .onSnapshot(snapshot => {
        const list = document.getElementById('wanted-list-body');
        list.innerHTML = "";
        snapshot.forEach(doc => {
            const p = doc.data();
            list.innerHTML += `<tr><td class="text-red-500 font-bold">${p.firstname} ${p.lastname}</td><td>WANTED</td></tr>`;
        });
    });
}

// ==========================================
// 8. PDF EXPORT
// ==========================================
async function exportToPDF(personId) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pDoc = await db.collection('persons').doc(personId).get();
    const p = pDoc.data();

    doc.text(`AKTE: ${p.firstname} ${p.lastname}`, 10, 10);
    doc.text(`Status: ${p.tags.join(', ')}`, 10, 20);
    doc.save(`Akte_${p.lastname}.pdf`);
}
// PLATZHALTER FÜR BERICHTE
async function loadReports() {
    const container = document.getElementById('report-list');
    if (!container) return console.error("HTML-Element 'report-list' fehlt!");
    
    container.innerHTML = "<p class='p-4 text-slate-500'>Lade Berichte...</p>";
    // Hier kommt später dein Firebase-Abruf rein
}

// PLATZHALTER FÜR BEAMTE
async function renderEmployeePanel() {
    const container = document.getElementById('employee-list');
    if (!container) return console.error("HTML-Element 'employee-list' fehlt!");

    container.innerHTML = "<p class='p-4 text-slate-500'>Lade Beamtenliste...</p>";
    // Hier kommt später dein Firebase-Abruf rein
}
