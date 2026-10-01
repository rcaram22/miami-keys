import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, setDoc, onSnapshot, deleteField, terminate, clearIndexedDbPersistence,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const app = initializeApp({
  apiKey: 'AIzaSyB-IzKr5hhvuoXKfSbg4vwMH_viwVPUmWs',
  authDomain: 'miami-keys.firebaseapp.com',
  projectId: 'miami-keys',
  storageBucket: 'miami-keys.firebasestorage.app',
  messagingSenderId: '961700087512',
  appId: '1:961700087512:web:fd57ce47f6911445dd39ad',
});
const auth = getAuth(app);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
const stateRef = doc(db, 'trips', 'mk26');
// Itinerary, lists, budget and flights, written by scripts/publish.mjs.
const contentRef = doc(db, 'trips', 'mk26_content');

const $ = id => document.getElementById(id);
const form = $('login'), err = $('login-err'), status = $('sync-status'), logout = $('logout');

const ERRORS = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/too-many-requests': 'Demasiados intentos. Probá de nuevo en unos minutos.',
  'auth/network-request-failed': 'Sin conexión. Hace falta internet para iniciar sesión.',
};

form.onsubmit = async e => {
  e.preventDefault();
  err.textContent = '';
  try {
    await signInWithEmailAndPassword(auth, $('f-email').value.trim(), $('f-pass').value);
  } catch (e) {
    err.textContent = ERRORS[e.code] || 'No se pudo iniciar sesión.';
  }
};
// Sign-out also wipes the offline copy so nothing about the trip stays on the device.
logout.onclick = async () => {
  await signOut(auth);
  await terminate(db);
  await clearIndexedDbPersistence(db).catch(console.error);
  location.reload();
};

const failed = e => {
  console.error(e);
  MK.fail(e.code === 'permission-denied'
    ? 'Tu usuario no tiene acceso a este viaje.'
    : 'No se pudo cargar el viaje. Probá de nuevo en un rato.');
};

let unsubs = [];
onAuthStateChanged(auth, user => {
  unsubs.forEach(u => u());
  unsubs = [];
  MK.disconnect();
  logout.hidden = status.hidden = !user;
  if (!user) return MK.signedOut();

  status.textContent = 'Sincronizado como ' + user.email + '.';
  MK.signedIn();
  MK.connect((section, key, value) =>
    setDoc(stateRef, { [section]: { [key]: value === undefined ? deleteField() : value } }, { merge: true })
      .catch(console.error));
  unsubs.push(onSnapshot(contentRef, s => {
    if (s.exists()) MK.setContent(JSON.parse(s.data().json));
    else MK.fail('Todavía no se publicó el contenido del viaje.');
  }, failed));
  unsubs.push(onSnapshot(stateRef, s => MK.replace(s.exists() ? s.data() : {}), failed));
});
