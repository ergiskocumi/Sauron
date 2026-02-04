import sys
from infrastructure.fortigate_client import FortiGateClient
from core.config import settings  # <--- IMPORTIAMO LA CONFIGURAZIONE

def main():
    # 1. Feedback visivo: Stampiamo i dati caricati dalla configurazione
    # (Tranne il token, che deve rimanere segreto!)
    print(f"\n{'='*60}")
    print(f"📡 SAURON - NETWORK DISCOVERY")
    print(f"🎯 Target IP:   {settings.fortigate_ip}")
    print(f"📂 Target VDOM: {settings.default_vdom}")
    print(f"{'='*60}\n")

    # 2. Inizializzazione Client
    # Passiamo le variabili dell'oggetto 'settings' invece delle stringhe fisse
    try:
        client = FortiGateClient(
            ip_address=settings.fortigate_ip, 
            api_token=settings.fortigate_api_token
        )
    except Exception as e:
        print(f"❌ Errore durante l'inizializzazione del client: {e}")
        sys.exit(1)

    # ---------------------------------------------------------
    # 3. TEST ROUTING (Routing Table Globale/Monitor)
    # ---------------------------------------------------------
    print(">>> Recupero Tabella di Routing...")
    try:
        routes = client.get_routing_table()
        print(f"✅ Trovate {len(routes)} rotte attive.\n")
        
        if routes:
            # Intestazione tabella
            print(f"{'DESTINATION':<20} {'GATEWAY':<18} {'PROTO':<10} {'INTF':<15} {'METRIC'}")
            print("-" * 75)
            # Stampiamo le prime 15 rotte
            for r in routes[:15]: 
                print(f"{r.destination:<20} {r.gateway:<18} {r.protocol:<10} {r.interface:<15} {r.metric}")
            
            if len(routes) > 15:
                print(f"... e altre {len(routes) - 15} rotte nascoste.")
        print("\n")
            
    except Exception as e:
        print(f"⚠️ Errore nel recupero rotte: {e}\n")

    # ---------------------------------------------------------
    # 4. TEST VLAN (Usa il VDOM definito nel .env)
    # ---------------------------------------------------------
    vdom_target = settings.default_vdom
    print(f">>> Recupero VLAN (VDOM: {vdom_target})...")
    
    try:
        # Usiamo il filtro server-side per scaricare solo le VLAN
        vlans = client.get_interfaces(vdom=vdom_target, type_filter="vlan")
        
        print(f"✅ Trovate {len(vlans)} VLAN.\n")
        
        if vlans:
            print(f"{'VLAN NAME':<25} {'ID':<5} {'IP ADDRESS':<18} {'PARENT':<15} {'STATUS'}")
            print("-" * 75)
            
            for v in vlans:
                status_icon = "🟢" if v.is_up else "🔴"
                
                # Clean Code: Gestione visualizzazione campi opzionali (None diventa stringa vuota o '-')
                vlan_id_str = str(v.vlan_id) if v.vlan_id is not None else "-"
                parent_str = v.parent_interface if v.parent_interface else "N/A"
                
                print(f"{v.name:<25} {vlan_id_str:<5} {v.ip:<18} {parent_str:<15} {status_icon}")
    
    except Exception as e:
        print(f"⚠️ Errore nel recupero VLAN: {e}")

    print(f"\n{'='*60}")
    print("🏁 Scansione completata.")

if __name__ == "__main__":
    main()