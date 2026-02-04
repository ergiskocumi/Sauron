# Sauron REST API

REST API per esporre le funzionalità di Sauron tramite HTTP.

## Avvio del Server

```bash
# Dalla root del progetto
uvicorn backend.api:app --reload
```

Il server sarà disponibile su: **http://127.0.0.1:8000**

## Test Interattivo (Swagger UI)

Apri il browser su: **http://127.0.0.1:8000/docs**

Vedrai l'interfaccia Swagger con tutti gli endpoint testabili con un click.

## Endpoints Disponibili

### 1. GET /api/inventory
Restituisce la lista dei firewall configurati (token oscurato per sicurezza).

**Esempio:**
```bash
curl http://127.0.0.1:8000/api/inventory
```

**Risposta:**
```json
[
  {
    "id": "fw-milano",
    "host": "10.101.201.1:10443",
    "entry_vdom": "root",
    "enabled": true
  }
]
```

---

### 2. GET /api/snapshot/status
Verifica se esiste uno snapshot e restituisce metadati.

**Esempio:**
```bash
curl http://127.0.0.1:8000/api/snapshot/status
```

**Risposta (snapshot non presente):**
```json
{
  "exists": false
}
```

**Risposta (snapshot presente):**
```json
{
  "exists": true,
  "path": "network.snapshot.gz",
  "timestamp": "2026-02-04T22:30:15",
  "age_human": "5m",
  "nodes_count": 12,
  "links_count": 8,
  "routes_count": 456,
  "interfaces_count": 34,
  "firewalls_count": 3
}
```

---

### 3. POST /api/scan
Avvia una scansione asincrona della rete.

**IMPORTANTE:** Questa operazione è lenta (10s+) e viene eseguita in background.

**Esempio:**
```bash
curl -X POST http://127.0.0.1:8000/api/scan
```

**Risposta:**
```json
{
  "status": "started",
  "message": "Network scan started. Check /api/snapshot/status for completion."
}
```

**Nota:** Dopo aver chiamato `/api/scan`, puoi controllare lo stato con `/api/snapshot/status`.

---

### 4. GET /api/topology
Restituisce la topologia completa (nodi e link) da snapshot.

**Prerequisito:** Devi aver eseguito `/api/scan` prima.

**Esempio:**
```bash
curl http://127.0.0.1:8000/api/topology
```

**Risposta:**
```json
{
  "nodes": [
    "fw-milano:root",
    "fw-roma:root"
  ],
  "links": [
    {
      "subnet": "192.168.1.0/24",
      "endpoints": ["fw-milano:root", "fw-roma:root"],
      "is_point_to_point": false,
      "endpoint_count": 2,
      "interfaces": [
        {
          "device_id": "fw-milano",
          "vdom": "root",
          "iface_name": "VLAN10",
          "ip": "192.168.1.1",
          "prefix_len": 24,
          "network_id": "192.168.1.0/24",
          "is_up": true
        }
      ]
    }
  ],
  "node_count": 2,
  "link_count": 1
}
```

---

### 5. POST /api/path
Calcola il percorso tra un nodo sorgente e un IP destinazione.

**Prerequisito:** Devi aver eseguito `/api/scan` prima.

**Body:**
```json
{
  "source": "fw-milano",
  "destination": "10.0.0.1",
  "max_ttl": 64
}
```

**Formato source:**
- `"fw-milano"` - Se il firewall ha un solo VDOM o usa il default (root)
- `"fw-milano:root"` - Specifica esplicitamente device:vdom

**Esempio:**
```bash
curl -X POST http://127.0.0.1:8000/api/path \
  -H "Content-Type: application/json" \
  -d '{
    "source": "fw-milano",
    "destination": "10.0.0.1",
    "max_ttl": 64
  }'
```

**Risposta:**
```json
{
  "source_node": {
    "device_id": "fw-milano",
    "vdom": "root"
  },
  "target_ip": "10.0.0.1",
  "hops": [
    {
      "node": {
        "device_id": "fw-milano",
        "vdom": "root"
      },
      "ingress_interface": null,
      "egress_interface": "port1",
      "matched_route_destination": "0.0.0.0/0",
      "matched_route_gateway": "10.101.201.254",
      "matched_route_protocol": "static",
      "action": "exit_wan",
      "next_hop_ip": "10.101.201.254"
    }
  ],
  "status": "exit_wan",
  "exit_point": "fw-milano:root",
  "exit_interface": "port1",
  "exit_gateway": "10.101.201.254"
}
```

**Status possibili:**
- `reached`: Pacchetto raggiunge la destinazione
- `dropped`: Pacchetto droppato (no route)
- `loop`: Loop di routing rilevato
- `ttl_exceeded`: TTL esaurito
- `exit_wan`: Pacchetto esce verso gateway esterno
- `no_neighbor`: Gateway non raggiungibile in topology

---

## CORS

L'API è configurata per accettare richieste da:
- `http://localhost:3000` (React default)
- `http://localhost:5173` (Vite default)
- `http://localhost:8080` (Vue CLI default)

Se usi un altro frontend, aggiungi l'origine in `backend/api.py` alla lista `allow_origins`.

---

## Test Manuale Completo

```bash
# 1. Verifica health check
curl http://127.0.0.1:8000/

# 2. Controlla inventory
curl http://127.0.0.1:8000/api/inventory

# 3. Verifica snapshot (deve tornare exists: false)
curl http://127.0.0.1:8000/api/snapshot/status

# 4. Avvia scansione
curl -X POST http://127.0.0.1:8000/api/scan

# 5. Aspetta qualche secondo e ricontrolla snapshot
curl http://127.0.0.1:8000/api/snapshot/status

# 6. Ottieni topologia
curl http://127.0.0.1:8000/api/topology

# 7. Calcola percorso
curl -X POST http://127.0.0.1:8000/api/path \
  -H "Content-Type: application/json" \
  -d '{"source": "fw-milano", "destination": "8.8.8.8"}'
```

---

## Troubleshooting

### Errore: "No snapshot found"
Devi eseguire prima `/api/scan` per creare lo snapshot.

### Errore: "Inventory file not found"
Assicurati che `inventory.json` esista nella root del progetto.

### Errore: "Invalid source"
Verifica che il nome del firewall sia corretto usando `/api/inventory`.

---

## Prossimi Passi

Ora che l'API funziona, puoi:

1. **Testare con Swagger UI**: http://127.0.0.1:8000/docs
2. **Creare un frontend React** che chiama questi endpoint
3. **Aggiungere autenticazione** (JWT, OAuth2) se necessario
