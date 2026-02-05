# Sauron Frontend - React Dashboard

Dashboard React per la visualizzazione e gestione della topologia di rete multi-firewall.

## Setup e Avvio

### Prerequisiti

- Node.js 18+
- Backend FastAPI avviato su `http://localhost:8000`

### Installazione

```bash
npm install
```

### Avvio Development Server

```bash
npm run dev
```

Frontend disponibile su: **http://localhost:5173**

## Architettura del Progetto

### Pattern Applicati

1. **Singleton Pattern** - API Client centralizzato
2. **Adapter Pattern** - Service Layer per API
3. **Custom Hooks** - Gestione stati riutilizzabile
4. **Composition** - UI Components riutilizzabili

### Struttura Cartelle

```
src/
├── api/         # Configurazione Axios (Singleton)
├── services/    # Service Layer (Adapter)
├── hooks/       # Custom Hooks
├── components/  # UI Components riutilizzabili
└── features/    # Feature Components
```

## Test Backend Connection

```bash
# Verifica che il backend sia avviato
curl http://localhost:8000/

# Verifica endpoint inventory
curl http://localhost:8000/api/inventory
```

## Troubleshooting

**Errore: "Impossibile contattare il server"**

Assicurati che il backend sia avviato:
```bash
cd ../
uvicorn backend.api:app --reload
```

---

**Tech Stack:** React 19 + Vite 7 + Tailwind CSS 4 + Axios
