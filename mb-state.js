// ═══════════════════════════════════════════════════════════════
//  mb-state.js — Estado global do Mesa Virtual
//  v2.0 — Firebase Realtime Database + cache localStorage
//
//  ⚠ Requer: firebase-config.js carregado ANTES deste arquivo
//
//  Estrutura no Firebase:
//    /mesas/{salaCode}/info        → dados da mesa e lista de jogadores
//    /mesas/{salaCode}/chars/{id}  → ficha de cada personagem
//    /mesas/{salaCode}/map         → estado do mapa (tokens, grid, etc.)
//    /mesas/{salaCode}/chat        → mensagens do chat (push)
//    /mesas/{salaCode}/init        → lista de iniciativa
// ═══════════════════════════════════════════════════════════════

/* ─── Helpers de acesso ao Firebase ─── */
function _fbDB() {
  try { return (typeof firebase !== 'undefined') ? firebase.database() : null; }
  catch(e) { return null; }
}
function _fbRef(path) {
  const db = _fbDB(); return db ? db.ref(path) : null;
}

// Rastreia keys de mensagens enviadas por ESTE cliente (evita eco no chat)
const _ownChatKeys = new Set();

/* ═══════════════════════════════════════════════════════════════
   MBState — API pública de estado
═══════════════════════════════════════════════════════════════ */
const MBState = {

  /* ──────────────────── SESSÃO ATUAL (apenas local) ──────────────────── */
  session: {
    get()          { try { return JSON.parse(sessionStorage.getItem('mb_session') || '{}'); } catch(e) { return {}; } },
    set(data)      { sessionStorage.setItem('mb_session', JSON.stringify(data)); },
    merge(data)    { this.set({ ...this.get(), ...data }); },
    clear()        { sessionStorage.removeItem('mb_session'); }
  },

  /* ──────────────────── MESA (Firebase + localStorage) ──────────────────── */
  table: {
    KEY: 'mb_table_v2',

    // Gera código curto e legível para a sala (ex: MB-X7K2P)
    _genCode() {
      return 'MB' + Math.random().toString(36).substr(2, 5).toUpperCase();
    },

    exists() {
      return !!localStorage.getItem(this.KEY);
    },

    get() {
      try {
        const raw = localStorage.getItem(this.KEY);
        return raw ? JSON.parse(raw) : null;
      } catch(e) { return null; }
    },

    save(data) {
      localStorage.setItem(this.KEY, JSON.stringify(data));
      const code = data.salaCode;
      if (!code) return;
      const r = _fbRef('mesas/' + code + '/info');
      if (r) r.set({ name: data.name, createdAt: data.createdAt, players: data.players || [] })
              .catch(e => console.warn('[MB] Firebase table sync:', e));
    },

    create(name) {
      const salaCode = this._genCode();
      const t = {
        name:      name || 'Mesa Mesa Virtual',
        createdAt: Date.now(),
        players:   [],
        salaCode
      };
      this.save(t);
      return t;
    },

    addPlayer(name, color) {
      const t = this.get() || { name: 'Mesa', createdAt: Date.now(), players: [], salaCode: this._genCode() };
      const p = { id: 'p_' + Date.now(), name, color: color || '#c84040' };
      t.players.push(p);
      this.save(t);
      return p;
    },

    removePlayer(id) {
      const t = this.get(); if (!t) return;
      t.players = t.players.filter(p => p.id !== id);
      this.save(t);
      if (t.salaCode) {
        const r = _fbRef('mesas/' + t.salaCode + '/chars/' + id);
        if (r) r.remove().catch(() => {});
      }
    },

    reset() {
      const t = this.get();
      if (t && t.salaCode) {
        const r = _fbRef('mesas/' + t.salaCode);
        if (r) r.remove().catch(() => {});
      }
      localStorage.removeItem(this.KEY);
    },

    getSalaCode() {
      const t = this.get();
      return t ? t.salaCode : null;
    }
  },

  /* ──────────────────── PERSONAGEM (Firebase + localStorage) ──────────── */
  char: {
    default(id) {
      return {
        id: id || ('char_' + Date.now()),
        // Identidade
        nome: '', raca: '', classe: '', nivel: 1, xp: 0, origem: '',
        // Atributos base
        for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10,
        // Combate
        pv: 20, pvMax: 20, pm: 10, pmMax: 10,
        defesa: 10, iniciativa: 0, velocidade: 9,
        ataqueCac: '+0', danoCac: '1d6',
        ataqueDist: '+0', danoDist: '1d6',
        // Texto livre
        pericias: '', equipamentos: '', poderes: '', notas: ''
      };
    },

    get(id) {
      try {
        const raw = localStorage.getItem('mb_char_' + id);
        if (!raw) return this.default(id);
        return { ...this.default(id), ...JSON.parse(raw) };
      } catch(e) { return this.default(id); }
    },

    save(char) {
      // Cache local
      localStorage.setItem('mb_char_' + char.id, JSON.stringify(char));
      const ids = this._listIds();
      if (!ids.includes(char.id)) {
        ids.push(char.id);
        localStorage.setItem('mb_char_ids', JSON.stringify(ids));
      }
      // Sync Firebase usando código da sessão atual
      const code = MBState.session.get().code;
      if (code && code !== 'LOCAL') {
        const r = _fbRef('mesas/' + code + '/chars/' + char.id);
        if (r) r.set(char).catch(e => console.warn('[MB] Firebase char sync:', e));
      }
    },

    _listIds() {
      try { return JSON.parse(localStorage.getItem('mb_char_ids') || '[]'); }
      catch(e) { return []; }
    },

    list() {
      return this._listIds().map(id => this.get(id));
    },

    // Carrega ficha direto do Firebase (sync entre dispositivos/sessões)
    loadFromFirebase(code, charId, cb) {
      if (!code || code === 'LOCAL') { cb(null); return; }
      const r = _fbRef('mesas/' + code + '/chars/' + charId);
      if (!r) { cb(null); return; }
      r.once('value', snap => {
        const data = snap.val();
        if (data) {
          const merged = { ...this.default(charId), ...data };
          try { localStorage.setItem('mb_char_' + charId, JSON.stringify(merged)); } catch(e) {}
          const ids = this._listIds();
          if (!ids.includes(charId)) {
            ids.push(charId);
            try { localStorage.setItem('mb_char_ids', JSON.stringify(ids)); } catch(e) {}
          }
          cb(merged);
        } else {
          cb(null);
        }
      }).catch(() => cb(null));
    }
  },

  /* ──────────────────── MAPA (Firebase + localStorage) ──────────────── */
  map: {
    default() {
      return {
        tokens:    [],
        gridSize:  50,
        showGrid:  true,
        fogActive: false,
        bgColor:   '#1c1712',
        bgImage:   null,
        panX:      0,
        panY:      0
      };
    },

    get(code) {
      try {
        const raw = localStorage.getItem('mb_map_' + code);
        return raw ? { ...this.default(), ...JSON.parse(raw) } : this.default();
      } catch(e) { return this.default(); }
    },

    save(code, data) {
      localStorage.setItem('mb_map_' + code, JSON.stringify(data));
      if (code && code !== 'LOCAL') {
        const r = _fbRef('mesas/' + code + '/map');
        if (r) r.set(data).catch(e => console.warn('[MB] Firebase map sync:', e));
      }
    },

    // Carrega mapa uma vez do Firebase; fallback para null (caller usa localStorage)
    loadFromFirebase(code, cb) {
      if (!code || code === 'LOCAL') { cb(null); return; }
      const r = _fbRef('mesas/' + code + '/map');
      if (!r) { cb(null); return; }
      r.once('value', snap => {
        const data = snap.val();
        if (data) {
          const merged = { ...this.default(), ...data };
          if (merged.tokens && !Array.isArray(merged.tokens)) {
            merged.tokens = Object.values(merged.tokens).filter(Boolean);
          }
          try { localStorage.setItem('mb_map_' + code, JSON.stringify(merged)); } catch(e) {}
          cb(merged);
        } else { cb(null); }
      }).catch(() => cb(null));
    }
  },

  /* ──────────────────── CHAT (Firebase + localStorage) ──────────────── */
  chat: {
    get(code) {
      try { return JSON.parse(localStorage.getItem('mb_chat_' + code) || '[]'); }
      catch(e) { return []; }
    },

    add(code, entry) {
      // msgId garante deduplicação mesmo após F5 (localStorage vs Firebase)
      entry = { ...entry, ts: Date.now(), msgId: Math.random().toString(36).substr(2, 10) };

      // Cache local
      const log = this.get(code);
      log.push(entry);
      if (log.length > 300) log.splice(0, log.length - 300);
      localStorage.setItem('mb_chat_' + code, JSON.stringify(log));

      // Firebase: gera a key ANTES de escrever para filtrar o echo local
      // (Firebase dispara child_added sincronamente durante set(), então
      //  a key precisa estar em _ownChatKeys antes da escrita acontecer)
      if (code && code !== 'LOCAL') {
        const r = _fbRef('mesas/' + code + '/chat');
        if (r) {
          const newRef = r.push();          // obtém key sem escrever
          _ownChatKeys.add(newRef.key);     // registra ANTES de gravar
          newRef.set(entry).catch(e => console.warn('[MB] Firebase chat sync:', e));
        }
      }
      return log;
    },

    clear(code) {
      localStorage.removeItem('mb_chat_' + code);
      if (code && code !== 'LOCAL') {
        const r = _fbRef('mesas/' + code + '/chat');
        if (r) r.remove().catch(() => {});
      }
    }
  },

  /* ──────────────────── INICIATIVA (Firebase + sessionStorage) ──────── */
  initiative: {
    _key(code) { return 'mb_init_' + code; },

    get(code) {
      try { return JSON.parse(sessionStorage.getItem(this._key(code)) || '[]'); }
      catch(e) { return []; }
    },

    save(code, list) {
      sessionStorage.setItem(this._key(code), JSON.stringify(list));
      if (code && code !== 'LOCAL') {
        const r = _fbRef('mesas/' + code + '/init');
        if (r) r.set(list).catch(e => console.warn('[MB] Firebase init sync:', e));
      }
    },

    clear(code) {
      sessionStorage.removeItem(this._key(code));
      if (code && code !== 'LOCAL') {
        const r = _fbRef('mesas/' + code + '/init');
        if (r) r.remove().catch(() => {});
      }
    }
  },

  /* ──────────────────── SYNC EM TEMPO REAL ──────────────────────────── */
  //
  //  Chame este método uma vez após carregar a mesa.
  //  Parâmetros de `callbacks`:
  //    onMapUpdate(data)   → chamado quando outro cliente atualiza o mapa
  //    onChatNew(entry)    → chamado quando outro cliente envia mensagem
  //    onInitUpdate(list)  → chamado quando a iniciativa muda
  //
  startSync(code, callbacks = {}) {
    if (!code || code === 'LOCAL') return;

    const db = _fbDB();
    if (!db) {
      console.warn('[MB] Firebase não configurado — rodando em modo offline (localStorage apenas).');
      return;
    }

    // ── Mapa ──
    if (callbacks.onMapUpdate) {
      db.ref('mesas/' + code + '/map').on('value', snap => {
        const data = snap.val();
        if (data) {
          localStorage.setItem('mb_map_' + code, JSON.stringify(data));
          callbacks.onMapUpdate(data);
        }
      });
    }

    // ── Chat — apenas mensagens NOVAS (não o histórico ao conectar) ──
    if (callbacks.onChatNew) {
      const chatRef = db.ref('mesas/' + code + '/chat');

      // 1. Carrega snapshot completo para saber QUAIS keys já existem
      // 2. Registra listener child_added DENTRO do callback (dados já em cache)
      //    → Firebase dispara child_added para histórico de forma síncrona
      //    → filtramos pelo Set → apenas mensagens novas passam
      // Momento em que esta sessão começou — só processa mensagens NOVAS
      const joinTs = Date.now();

      // IDs já no localStorage — deduplicação após F5
      const localLog = MBState.chat.get(code);
      const localMsgIds = new Set(localLog.filter(e => e.msgId).map(e => e.msgId));

      // Registra listener direto — mensagens antigas filtradas por joinTs
      chatRef.on('child_added', childSnap => {
        const key   = childSnap.key;
        const entry = childSnap.val();
        if (!entry) return;

        // Mensagem sem ts ou anterior ao carregamento — já está no localStorage
        if (!entry.ts || entry.ts < joinTs) return;

        // Mensagem enviada por NÓS mesmos — já renderizada localmente
        if (_ownChatKeys.has(key)) {
          _ownChatKeys.delete(key);
          return;
        }

        // Mensagem nossa que ainda não foi confirmada pelo Firebase antes do F5
        if (entry.msgId && localMsgIds.has(entry.msgId)) return;

        // Persiste no localStorage para aparecer após F5 do receptor
        const log = MBState.chat.get(code);
        log.push(entry);
        if (log.length > 300) log.splice(0, log.length - 300);
        localStorage.setItem('mb_chat_' + code, JSON.stringify(log));

        callbacks.onChatNew(entry);

      }, err => {
        console.error('[MB] Erro listener chat:', err);
      });
    }

    // ── Iniciativa ──
    if (callbacks.onInitUpdate) {
      db.ref('mesas/' + code + '/init').on('value', snap => {
        const data = snap.val();
        // Firebase pode retornar array ou objeto, normaliza para array
        const list = data
          ? (Array.isArray(data) ? data : Object.values(data))
          : [];
        sessionStorage.setItem('mb_init_' + code, JSON.stringify(list));
        callbacks.onInitUpdate(list);
      });
    }

    console.log('[MB] Sync em tempo real ativo para sala:', code);
  }
};

/* ═══════════════════════════════════════════════════════════════
   DICE — Utilitário de rolagem de dados
   Suporta: 2d6+3, 1d20, d8-2, 5d10, flat (ex: 3)
═══════════════════════════════════════════════════════════════ */
const Dice = {
  roll(sides) {
    return Math.floor(Math.random() * sides) + 1;
  },

  rollN(qty, sides) {
    const rolls = [];
    for (let i = 0; i < qty; i++) rolls.push(this.roll(sides));
    return rolls;
  },

  parse(expr) {
    expr = String(expr).trim().toLowerCase().replace(/\s/g, '');

    if (/^-?\d+$/.test(expr)) {
      return { rolls: [], total: parseInt(expr), expr, sides: 0, qty: 0, mod: 0, ok: true };
    }

    const m = expr.match(/^(\d*)d(\d+)([+-]\d+)?$/);
    if (!m) return { ok: false, error: 'Expressão inválida: ' + expr };

    const qty   = Math.min(parseInt(m[1] || '1'), 20);
    const sides = parseInt(m[2]);
    const mod   = parseInt(m[3] || '0');

    if (qty < 1 || sides < 2) return { ok: false, error: 'Dados inválidos' };

    const rolls = this.rollN(qty, sides);
    const sum   = rolls.reduce((a, b) => a + b, 0) + mod;

    return { rolls, total: sum, expr, sides, qty, mod, ok: true };
  },

  format(result) {
    if (!result.ok) return `❌ ${result.error}`;
    if (!result.rolls.length) return `= **${result.total}**`;
    const rollsStr = result.rolls.join(', ');
    const modStr   = result.mod > 0 ? ` +${result.mod}` : result.mod < 0 ? ` ${result.mod}` : '';
    return `[${rollsStr}]${modStr} = **${result.total}**`;
  },

  mod(val) {
    return Math.floor((parseInt(val) - 10) / 2);
  },

  modStr(val) {
    const m = this.mod(val);
    return m >= 0 ? '+' + m : String(m);
  }
};

/* ═══════════════════════════════════════════════════════════════
   AUTH — Firebase Authentication helpers
═══════════════════════════════════════════════════════════════ */
MBState.auth = {
  current() {
    try { return (typeof firebase !== 'undefined') ? firebase.auth().currentUser : null; }
    catch(e) { return null; }
  },
  onState(cb) {
    try {
      if (typeof firebase !== 'undefined') firebase.auth().onAuthStateChanged(cb);
      else cb(null);
    } catch(e) { cb(null); }
  },
  signIn(email, pw)  { return firebase.auth().signInWithEmailAndPassword(email, pw); },
  signUp(email, pw)  { return firebase.auth().createUserWithEmailAndPassword(email, pw); },
  signOut()          { return firebase.auth().signOut(); }
};

/* ═══════════════════════════════════════════════════════════════
   USER TABLE — Mesa do GM salva no Firebase sob o UID
   Estrutura: /usuarios/{uid}/mesa
   Mantém /mesas/{code}/info sincronizado para os jogadores
═══════════════════════════════════════════════════════════════ */
MBState.userTable = {

  _ref(uid) { return _fbRef('usuarios/' + uid + '/mesa'); },

  // Carrega mesa do GM — Firebase primeiro, fallback localStorage
  // cb(data, fromFirebase) — fromFirebase=false indica que veio só do localStorage
  load(uid, cb) {
    const lsKey = 'mb_user_table_' + uid;
    const localFallback = (permissionDenied) => {
      if (permissionDenied) console.warn('[MB] Firebase PERMISSION_DENIED — verifique as regras do Realtime Database.');
      try { cb(JSON.parse(localStorage.getItem(lsKey) || 'null'), false); }
      catch(e) { cb(null, false); }
    };
    const r = this._ref(uid);
    if (!r) { localFallback(false); return; }
    r.once('value', snap => {
      const data = snap.val();
      if (data) {
        try { localStorage.setItem(lsKey, JSON.stringify(data)); } catch(e) {}
        cb(data, true); // veio do Firebase ✓
      } else {
        localFallback(false);
      }
    }).catch(e => localFallback(e && e.code === 'PERMISSION_DENIED'));
  },

  // Salva mesa no Firebase E em localStorage (backup local)
  // Retorna Promise para que o chamador possa reagir a erros
  save(uid, data) {
    // Backup localStorage (garante persistência se Firebase falhar)
    try { localStorage.setItem('mb_user_table_' + uid, JSON.stringify(data)); } catch(e) {}
    const r = this._ref(uid);
    const fbPromise = r
      ? r.set(data).catch(e => {
          console.warn('[MB] userTable.save error:', e.code || e.message);
          return Promise.reject(e); // propaga para o chamador
        })
      : Promise.reject(new Error('Firebase não disponível'));
    if (data && data.salaCode) {
      const mr = _fbRef('mesas/' + data.salaCode + '/info');
      if (mr) mr.set({
        name: data.name,
        createdAt: data.createdAt,
        players: data.players || [],
        ownerUid: uid
      }).catch(e => console.warn('[MB] mesas sync:', e));
    }
    return fbPromise;
  },

  // Cria nova mesa e persiste; retorna { table, fbPromise }
  create(uid, name) {
    const salaCode = MBState.table._genCode();
    const d = { name: name || 'Mesa', createdAt: Date.now(), players: [], salaCode, ownerUid: uid };
    const fbPromise = this.save(uid, d);
    return { table: d, fbPromise };
  },

  // Adiciona jogador e persiste
  addPlayer(uid, data, name, color) {
    const p = { id: 'p_' + Date.now(), name, color: color || '#c84040' };
    const updated = { ...data, players: [...(data.players || []), p] };
    this.save(uid, updated);
    return updated;
  },

  // Remove jogador e persiste
  removePlayer(uid, data, pid) {
    const updated = { ...data, players: (data.players || []).filter(p => p.id !== pid) };
    this.save(uid, updated);
    if (data.salaCode) {
      const r = _fbRef('mesas/' + data.salaCode + '/chars/' + pid);
      if (r) r.remove().catch(() => {});
    }
    return updated;
  },

  // Apaga mesa do Firebase completamente
  reset(uid, data) {
    if (data && data.salaCode) {
      const r = _fbRef('mesas/' + data.salaCode);
      if (r) r.remove().catch(() => {});
    }
    const r = this._ref(uid);
    if (r) r.remove().catch(() => {});
    try { localStorage.removeItem('mb_user_table_' + uid); } catch(e) {}
  }
};

/* ═══════════════════════════════════════════════════════════════
   CHAR LIST — Lista de fichas por jogador (companions, animais, etc.)
   Estrutura Firebase: /mesas/{code}/playerChars/{pid} = [ {id, label}, ... ]
═══════════════════════════════════════════════════════════════ */
MBState.charList = {

  _fbPath(code, pid) { return 'mesas/' + code + '/playerChars/' + pid; },
  _lsKey(code, pid)  { return 'mb_charlist_' + code + '_' + pid; },

  getLocal(code, pid) {
    try { return JSON.parse(localStorage.getItem(this._lsKey(code, pid)) || '[]'); }
    catch(e) { return []; }
  },

  save(code, pid, list) {
    try { localStorage.setItem(this._lsKey(code, pid), JSON.stringify(list)); } catch(e) {}
    if (!code || code === 'LOCAL') return;
    const r = _fbRef(this._fbPath(code, pid));
    if (r) r.set(list).catch(e => console.warn('[MB] charList.save:', e));
  },

  // Carrega lista do Firebase com fallback para localStorage
  loadFromFirebase(code, pid, cb) {
    if (!code || code === 'LOCAL') { cb(this.getLocal(code, pid)); return; }
    const r = _fbRef(this._fbPath(code, pid));
    if (!r) { cb(this.getLocal(code, pid)); return; }
    r.once('value', snap => {
      const data = snap.val();
      if (data) {
        const list = Array.isArray(data)
          ? data.filter(Boolean)
          : Object.values(data).filter(Boolean);
        try { localStorage.setItem(this._lsKey(code, pid), JSON.stringify(list)); } catch(e) {}
        cb(list);
      } else {
        cb(this.getLocal(code, pid));
      }
    }).catch(() => cb(this.getLocal(code, pid)));
  }
};
