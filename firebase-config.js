// ═══════════════════════════════════════════════════════════════
//  firebase-config.js — Credenciais do Firebase para Mighty Blade VTT
//
//  COMO PREENCHER:
//  1. Acesse console.firebase.google.com
//  2. Selecione seu projeto
//  3. Vá em Configurações do projeto (⚙) → Geral → Seus apps → Config
//  4. Copie os valores e cole abaixo
//  5. Certifique-se que o Realtime Database está ativado no projeto
// ═══════════════════════════════════════════════════════════════

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyB2fO72uWaCIzupDHa2MjmgNOYD65olAvI",
  authDomain:        "mighty-blade-vtt.firebaseapp.com",
  databaseURL:       "https://mighty-blade-vtt-default-rtdb.firebaseio.com",
  projectId:         "mighty-blade-vtt",
  storageBucket:     "mighty-blade-vtt.firebasestorage.app",
  messagingSenderId: "627846178818",
  appId:             "1:627846178818:web:114b47a3056e2f56839f1b"
};

// ─── Inicializa Firebase (executa uma única vez) ───
try {
  if (typeof firebase !== 'undefined') {
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
      console.log('[MB] Firebase conectado ao projeto:', FIREBASE_CONFIG.projectId);
    }
  } else {
    console.warn('[MB] Firebase SDK não encontrado. Verifique os <script> no HTML.');
  }
} catch(e) {
  console.error('[MB] Erro ao inicializar Firebase:', e.message);
}

// ─── REGRAS NECESSÁRIAS NO FIREBASE CONSOLE ────────────────────
//
// Realtime Database Rules (Realtime Database → Rules):
//   { "rules": { ".read": "auth != null", ".write": "auth != null" } }
//
// Obs: Firebase Storage NÃO é necessário — imagens de fundo e
// avatares de token são comprimidos no browser e salvos direto
// no Realtime Database como base64 (plano gratuito é suficiente).
// ────────────────────────────────────────────────────────────────
