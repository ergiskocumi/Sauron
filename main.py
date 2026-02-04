import asyncio
import sys
from infrastructure.fortigate_client import FortiGateClient
from core.config import settings

# 1. Definiamo la funzione come ASINCRONA
async def main():
    print(f"\n{'='*60}")
    print(f"📡 SAURON (ASYNC CLI) - NETWORK DISCOVERY")
    print(f"🔖 Version: {settings.app_version}")
    print(f"🔖 API Version: {settings.api_version}")
    print(f"🎯 Target IP: {settings.fortigate_ip}")
    print(f"{'='*60}\n")

    try:
        # Inizializziamo il client (questo è sincrono, prepara solo l'oggetto)
        client = FortiGateClient(
            ip_address=settings.fortigate_ip, 
            api_token=settings.fortigate_api_token
        )
    except Exception as e:
        print(f"❌ Errore inizializzazione client: {e}")
        sys.exit(1)

    # ---------------------------------------------------------
    # FASE 1: DISCOVERY DEI VDOM
    # ---------------------------------------------------------
    print("🔍 Ricerca VDOM attivi...")
    try:
        # 2. Usiamo AWAIT perché stiamo aspettando una risposta di rete
        vdom_list = await client.get_vdoms()
        
        # Estraiamo i nomi per stamparli
        vdom_names = [v.name for v in vdom_list]
        print(f"✅ Trovati {len(vdom_list)} VDOM: {', '.join(vdom_names)}\n")
        
    except Exception as e:
        print(f"❌ Errore recupero VDOM: {e}")
        sys.exit(1)

    # ---------------------------------------------------------
    # FASE 2: ANALISI SEQUENZIALE (Routing + VLAN per ogni VDOM)
    # ---------------------------------------------------------
    
    # A. ROUTING TABLE (Globale)
    print(f"📂 RECUPERO ROUTING TABLE (Globale)...")
    try:
        routes = await client.get_routing_table()
        print(f"   ✅ Trovate {len(routes)} rotte attive.\n")
        
        if routes:
             print(f"   {'DESTINATION':<20} {'GATEWAY':<18} {'PROTO':<10} {'INTF':<15}")
             print(f"   {'-'*65}")
             for r in routes[:10]:
                 print(f"   {r.destination:<20} {r.gateway:<18} {r.protocol:<10} {r.interface:<15}")
             if len(routes) > 10:
                 print(f"   ... altre {len(routes)-10} nascoste.")
        print("")

    except Exception as e:
        print(f"   ⚠️ Errore Routing: {e}\n")

    # B. VLAN PER OGNI VDOM
    for vdom in vdom_list:
        print(f"📂 ANALISI INTERFACCE VDOM: {vdom.name.upper()}")
        
        try:
            # 3. Usiamo AWAIT anche qui dentro il ciclo
            vlans = await client.get_interfaces(vdom=vdom.name, type_filter="vlan")

            if not vlans:
                print("   ℹ️  Nessuna VLAN configurata.\n")
                continue

            print(f"   ✅ Trovate {len(vlans)} VLAN:")
            print(f"   {'-'*65}")
            print(f"   {'NAME':<25} {'ID':<5} {'IP ADDRESS':<18} {'STATUS'}")
            print(f"   {'-'*65}")

            for v in vlans:
                status_icon = "🟢" if v.is_up else "🔴"
                vlan_id = str(v.vlan_id) if v.vlan_id is not None else "-"
                print(f"   {v.name:<25} {vlan_id:<5} {v.ip:<18} {status_icon}")
            print("")

        except Exception as e:
            print(f"   ⚠️  Errore nel VDOM {vdom.name}: {e}\n")

    print(f"{'='*60}")
    print("🏁 Scansione Completata.")

if __name__ == "__main__":
    # 4. ENTRY POINT ASINCRONO
    # Questo comando crea il "loop" che permette di eseguire le funzioni async
    asyncio.run(main())