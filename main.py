import asyncio
import sys

# Importiamo il loader dell'inventario e il client
from core.inventory import InventoryLoader
from infrastructure.fortigate_client import FortiGateClient

async def main():
    print(f"\n{'='*60}")
    print(f"📡 SAURON - MULTI-FIREWALL DISCOVERY")
    print(f"{'='*60}\n")

    # 1. CARICAMENTO INVENTARIO
    loader = InventoryLoader("inventory.json")
    firewall_configs = loader.load()

    print(f"📋 Caricati {len(firewall_configs)} firewall dall'inventario.\n")

    # 2. CICLO SU OGNI FIREWALL
    for fw_config in firewall_configs:
        print(f"\n{'#'*60}")
        print(f"🔥 ANALISI FIREWALL: {fw_config.id.upper()}")
        print(f"   Target: {fw_config.host}")
        print(f"{'#'*60}\n")

        # Inizializziamo il client
        try:
            client = FortiGateClient(
                ip_address=fw_config.host, 
                api_token=fw_config.token
            )
        except Exception as e:
            print(f"❌ Errore init client per {fw_config.id}: {e}")
            continue 

        # --- FASE 1: SCOPERTA VDOM ---
        print("   🔍 1. Ricerca VDOM attivi...")
        try:
            vdom_list = await client.get_vdoms()
            names = [v.name for v in vdom_list]
            print(f"   ✅ Trovati {len(vdom_list)} VDOM: {', '.join(names)}\n")
        except Exception as e:
            print(f"   ❌ Errore critico VDOM su {fw_config.id}: {e}")
            continue 

        # --- FASE 2: ANALISI PER OGNI VDOM ---
        print(f"   📊 2. Analisi Dettagliata (Routing & Switching)...")
        
        for vdom in vdom_list:
            print(f"\n      🔹 VDOM: '{vdom.name}'")
            
            # A. SCARICO ROTTE DEL VDOM
            try:
                # Passiamo il nome del vdom corrente per avere le rotte GIUSTE
                routes = await client.get_routing_table(vdom=vdom.name)
                
                # Filtriamo per contare quelle "vere" (non connected)
                real_routes = [r for r in routes if r.protocol != 'connected']
                
                print(f"         📍 Routing: {len(routes)} rotte totali ({len(real_routes)} OSPF/Statiche)")
                
                # --- STAMPA DETTAGLIO ROTTE (Le prime 10 per non intasare) ---
                if routes:
                    print(f"            {'-'*60}")
                    print(f"            {'DESTINATION':<18} {'GATEWAY':<15} {'PROTO':<6} {'INTF'}")
                    print(f"            {'-'*60}")
                    # Ordiniamo: prima le default route (0.0.0.0), poi le altre
                    routes.sort(key=lambda x: x.destination) 
                    
                    for r in routes[:10]: # <--- MODIFICA QUESTO NUMERO SE NE VUOI DI PIU'
                        # Abbelliamo l'output
                        proto = r.protocol[:5] # Accorciamo 'connected' in 'conne' per spazio
                        print(f"            {r.destination:<18} {r.gateway:<15} {proto:<6} {r.interface}")
                    
                    if len(routes) > 10:
                        print(f"            ... altre {len(routes)-10} nascoste.")
                # -------------------------------------------------------------

            except Exception as e:
                print(f"         ⚠️  Err. Routing: {e}")

            # B. SCARICO VLAN DEL VDOM
            try:
                vlans = await client.get_interfaces(vdom=vdom.name, type_filter="vlan")
                
                if vlans:
                    print(f"\n         🔌 VLAN:    {len(vlans)} interfacce")
                    for v in vlans[:5]: # Stampa le prime 5 VLAN
                        status = "🟢" if v.is_up else "🔴"
                        print(f"            - [{v.vlan_id}] {v.name:<15} {v.ip:<15} {status}")
                    if len(vlans) > 5:
                        print(f"            - ... altre {len(vlans)-5}")
                else:
                    print(f"\n         🔌 VLAN:    0 (Nessuna VLAN)")

            except Exception as e:
                print(f"         ⚠️  Err. VLAN: {e}")

    print(f"\n{'='*60}")
    print("🏁 Scansione Multi-Firewall Completata.")

if __name__ == "__main__":
    asyncio.run(main())