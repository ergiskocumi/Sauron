# 👁️ SAURON - Network Discovery Tool

**Sauron** è un tool avanzato per l'analisi e il monitoraggio di firewall Fortinet FortiGate.
Progettato seguendo i principi della **Clean Architecture** e sviluppato in Python moderno, utilizza un approccio completamente **Asincrono (Async I/O)** per garantire alte prestazioni e non bloccare l'esecuzione durante le chiamate di rete.

---

## 🏗️ Architettura del Progetto

Il progetto è diviso in layer distinti per garantire manutenibilità e scalabilità:

* **Domain (`/domain`)**: Contiene la logica di business pura e i modelli dati (`models.py`) validati con Pydantic. Definisce le interfacce astratte (`ports.py`). Non sa nulla del database o delle API esterne.
* **Infrastructure (`/infrastructure`)**: Implementa le interfacce del dominio. Qui risiede il `FortiGateClient` che comunica con il firewall reale usando `httpx` (Asincrono).
* **Core (`/core`)**: Gestione della configurazione e delle variabili d'ambiente (`config.py`).
* **App (`/app`)**: Il layer di presentazione Web (API REST con FastAPI).
* **CLI (`main.py`)**: Il layer di presentazione da riga di comando per test rapidi e debug.

---

## ⚡ Tecnologie Chiave

* **Python 3.10+**
* **FastAPI**: Framework web moderno ad alte prestazioni.
* **Httpx**: Client HTTP asincrono di nuova generazione (ha sostituito `requests`).
* **Pydantic V2**: Validazione robusta dei dati e parsing automatico.
* **Pydantic Settings**: Gestione sicura della configurazione tramite file `.env`.
* **Uvicorn**: Server ASGI per eseguire l'applicazione Web.

---

## 🚀 Guida all'Installazione

### 1. Prerequisiti
Assicurati di avere Python installato. Clona la repository e crea un virtual environment:

```bash
python -m venv .venv
source .venv/bin/activate  # Mac/Linux
.venv\Scripts\activate     # Windows
```

## Installazione Dipendenze
Le dipendenze che servono per questo progetto per poter funzionare sono: 
```bash
requests
pydantic-settings
urllib3
httpx
pydantic
fastapi
uvicorn
pytest
pytest-asyncio

```
Per poterle installare da CLI, digitare:
```bash
pip install -r requirements.txt
```
## Configurazione (.env)
Crea un file .env nella root del progetto (non committarlo su Git!) con il seguente contenuto:

```bash
FORTIGATE_IP=<ip_firewall_desiderato>:10443
FORTIGATE_API_TOKEN=inserisci_tuo_token_api
DEFAULT_VDOM=<vdom_desiderato> 
API_TIMEOUT=10
```

# 🖥️ Utilizzo
## Modalità CLI (Command Line)
Esegue una scansione asincrona (parallela su VDOM multipli) e stampa i risultati a video:
```bash
python main.py
```

# 📡 Mappa delle API FortiOS (Inventory)

Questa sezione documenta gli endpoint verificati e funzionanti utilizzati dall'applicazione.

### 1. Lista VDOM (Virtual Domains)
Recupera l'elenco dei domini virtuali per popolare la navigazione.

* **Metodo Interno**: `get_vdoms()`
* **Endpoint Reale**: `GET /api/v2/cmdb/system/vdom`
* **Parametri**: `vdom=root` (Necessario per vedere la lista globale)
* **Perché questo endpoint**: È l'unico che restituisce la lista degli oggetti VDOM (`name`, `short-name`). L'endpoint di monitoraggio interfacce non fornisce questa lista.

### 2. Routing Table (IPv4)
Recupera le rotte attive (Statiche, Connesse, OSPF, BGP).

* **Metodo Interno**: `get_routing_table()`
* **Endpoint Reale**: `GET /api/v2/monitor/router/ipv4`
* **Parametri**: `vdom=root` (o specifico VDOM)
* **Dati Chiave**: `ip_mask` (Destinazione), `gateway`, `interface`, `metric`.

### 3. Interfacce e VLAN (Configurazione & Stato)
Recupera i dettagli delle interfacce, filtrando specificamente per le VLAN.

* **Metodo Interno**: `get_interfaces()`
* **Endpoint Reale**: `GET /api/v2/cmdb/system/interface`
* **Parametri Critici**:
    * `vdom=...`: Seleziona il contesto (es. Wethecs-VPN).
    * `filter=type==vlan`: **Fondamentale**. Filtra lato server per scaricare solo le VLAN, risparmiando banda e tempo CPU.
* **Dati Chiave**: `name`, `ip`, `status` (Up/Down), `vlanid`, `interface` (Parent Port).
* **Nota**: Usiamo l'endpoint `cmdb` (e non `monitor`) perché ci permette di filtrare per `type` e ottenere il `vlanid`, dati che nell'endpoint di monitoraggio spesso mancano.


## 📂 Struttura Cartelle

```bash
Sauron/
│
├── .env                   # Credenziali (IGNORATO DA GIT)
├── .gitignore             # File da escludere (venv, .env, pyc)
├── requirements.txt       # Dipendenze Python (httpx, fastapi, pydantic...)
├── README.md              # Documentazione del progetto
├── main.py                # Entry Point CLI (Script Asincrono)
│
├── app/                   # Web Server Layer
│   ├── __init__.py
│   └── main.py            # Entry Point FastAPI (Server)
│
├── core/                  # Configuration Layer
│   └── config.py          # Caricamento Settings da .env
│
├── domain/                # Business Logic Layer
│   ├── models.py          # Entità Pydantic (Vdom, Route, NetworkInterface)
│   └── ports.py           # Interfacce Astratte (FirewallRepository)
│
└── infrastructure/        # Data Access Layer
    └── fortigate_client.py # Implementazione Client Httpx Asincrono
```


Api trovate e funzionanti 

PER trovare la tabella di routing: 
==>  https://10.101.201.1:10443/api/v2/monitor/router/ipv4  => con auth il barer token 


per lo stato delle interfacce: 
 https://10.101.201.1:10443/api/v2/monitor/system/interface => con auth il barer token


per trovare tutte le VDOM:
 [/api/v2/monitor/system/interface?vdom=root](https://10.101.201.1:10443/api/v2/monitor/system/interface?vdom=root)


  https://10.101.201.1:10443/api/v2/cmdb/system/interface

  https://10.101.201.1:10443/api/v2/cmdb/system/interface?filter=type==vlan&vdom=Wethecs-VPN