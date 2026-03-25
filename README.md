# ⚔ MightyBlade VTT

Mesa virtual de RPG rodando 100% no navegador, com Firebase Realtime Database e Firebase Authentication.

## Funcionalidades
- 🗺 Mapa interativo com tokens, grade e névoa de guerra
- 💬 Chat em tempo real (Firebase Realtime DB)
- 🎲 Dados 3D animados (d4 a d100)
- ⚔ Ficha MIGHTYBLADE completa (4 atributos, habilidades, magias, equipamento)
- 👤 Login do Mestre via Firebase Auth (mesa salva na conta, na nuvem)
- ⚔ Iniciativa sincronizada entre jogadores
- 📋 Múltiplas fichas por jogador (companions, animais, alter-egos)
- 👥 Jogadores ilimitados por sala

## Deploy
🌐 **https://mb.sampsvsl.com.br**

## Tecnologias
- HTML + Vanilla JS + Vanilla CSS
- Firebase Realtime Database (sync em tempo real)
- Firebase Authentication (login do Mestre + auth anônima para jogadores)
- GitHub Pages / hospedagem estática

---

## ⚠ Configuração Firebase — OBRIGATÓRIO

### 1. Realtime Database — Regras de Segurança

No [Firebase Console](https://console.firebase.google.com) → **Realtime Database → Regras**, cole:

```json
{
  "rules": {
    "usuarios": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "mesas": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

> `auth != null` aceita tanto o GM (login email/senha) quanto jogadores (login anônimo automático).

### 2. Authentication — Habilitar Provedores

No Firebase Console → **Authentication → Sign-in method**, ative:
- ✅ **E-mail/senha** (para o Mestre)
- ✅ **Anônimo** (para jogadores entrarem com o código da sala sem precisar de conta)
