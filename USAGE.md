# SAURON - Uso e comandi

Questo file descrive come usare il progetto, i comandi CLI disponibili e i casi d'uso piu' comuni.

## Avvio rapido

Usa il Python del virtual environment:

```
venv\Scripts\python.exe main.py --help
```

## Comandi principali

### 1) scan
Scansiona i firewall definiti nell'inventario e salva uno snapshot.

```
venv\Scripts\python.exe main.py scan -i inventory.json -o network.snapshot
```

Opzioni utili:
- `-s` / `--sequential`: disabilita la scansione parallela.
- `--no-compress`: salva lo snapshot non compresso.

### 2) demo
Genera uno snapshot offline di esempio (utile per test veloci senza firewall).

```
venv\Scripts\python.exe main.py demo -o demo.snapshot
```

Opzioni utili:
- `--no-compress`: salva lo snapshot non compresso.

### 3) info
Mostra i metadati e le statistiche di uno snapshot.

```
venv\Scripts\python.exe main.py info -s network.snapshot
```

### 4) topology
Mostra la topologia contenuta nello snapshot.

```
venv\Scripts\python.exe main.py topology -s network.snapshot
```

### 5) path
Simula un percorso di rete tra un nodo sorgente e un IP destinazione.

```
venv\Scripts\python.exe main.py path -s network.snapshot --src fw1:root --dst 10.0.0.5
```

Regole di risoluzione sorgente:
- Se passi `--src fw1:root`, viene usato esattamente quel VDOM.
- Se passi `--src fw1`, il resolver usa il VDOM di default (di solito `root`).
- Se il device ha piu' VDOM e non esiste il default, ti chiede di specificare `device:vdom`.

Opzioni utili:
- `--ttl 32`: imposta il TTL massimo (hop limit).
- `--dot output.dot`: esporta il percorso in formato Graphviz DOT.

Esempio DOT:
```
venv\Scripts\python.exe main.py path -s network.snapshot --src fw1 --dst 10.0.0.5 --dot path.dot
```

Se hai Graphviz installato, puoi renderizzare il DOT (esempio):
```
dot -Tpng path.dot -o path.png
```

## Formato inventory.json

Il file inventory deve essere una lista JSON. Esempio:

```
[
  {
    "id": "fw-milano",
    "host": "10.0.0.1:443",
    "token": "FORTI_API_TOKEN",
    "entry_vdom": "root",
    "enabled": true
  },
  {
    "id": "fw-roma",
    "host": "10.0.0.2:443",
    "token": "FORTI_API_TOKEN",
    "entry_vdom": "root",
    "enabled": false
  }
]
```

Note:
- `host` richiede sempre `ip:porta`.
- `enabled=false` esclude il firewall dalla scansione.

## Snapshot e compressione

Per default gli snapshot sono compressi. Anche se l'estensione e' `.snapshot`, il file puo' essere gzip.
Il loader riconosce automaticamente il formato.

Se vuoi salvarlo non compresso:
```
venv\Scripts\python.exe main.py scan --no-compress -o network.snapshot
```

## Limitazioni note

- La simulazione e' basata sul routing path. Il NAT non e' considerato (V1).
- IPv6 non e' supportato nella simulazione attuale.

## Troubleshooting

- Errore "Snapshot corrotto": spesso significa formato non riconosciuto. Con l'ultima versione il loader auto-rileva gzip.
- Errore inventario: verifica che `inventory.json` sia una lista di oggetti con i campi richiesti.
- Problemi di moduli mancanti: assicurati di usare `venv\Scripts\python.exe`.
