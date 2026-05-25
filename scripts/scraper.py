import urllib.request
import json
import re
import os
import sys
import base64
from datetime import datetime, timedelta

def get_week_dates(weeks_ago=0):
    today = datetime.now()
    monday = today - timedelta(days=today.weekday())
    target_monday = monday - timedelta(weeks=weeks_ago)
    target_sunday = target_monday + timedelta(days=6)
    return target_monday.strftime('%Y-%m-%d'), target_sunday.strftime('%Y-%m-%d')

def load_github_config():
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".github_config")
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            return json.load(f)
    return {}

def save_github_config(repo, token):
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".github_config")
    with open(config_path, "w") as f:
        json.dump({"repo": repo, "token": token}, f)

def upload_to_github(filepath, repo, token):
    filename = os.path.basename(filepath)
    url = f"https://api.github.com/repos/{repo}/contents/{filename}"
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "LotteryTracker"
    }

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            sha = data['sha']
    except urllib.error.HTTPError as e:
        if e.code == 404:
            sha = None
        else:
            print(f"Error de GitHub al revisar {filename}: {e}")
            return False
    except Exception as e:
        return False

    with open(filepath, "rb") as f:
        content = base64.b64encode(f.read()).decode("utf-8")

    data = {
        "message": f"Actualización automática de {filename}",
        "content": content
    }
    if sha:
        data["sha"] = sha

    req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers=headers, method="PUT")
    try:
        with urllib.request.urlopen(req) as response:
            if response.status in [200, 201]:
                print(f"  [GitHub] -> ¡{filename} subido con éxito!")
                return True
    except Exception as e:
        print(f"  [GitHub] -> Error al subir {filename}: {e}")
    return False


ANIMAL_MAP = {
    # 00, 0-36 (Tradicional)
    "Ballena": "00", "Delfin": "0", "Carnero": "1", "Toro": "2", "Ciempies": "3", "Cienpies": "3", "Alacran": "4",
    "Leon": "5", "Rana": "6", "Perico": "7", "Raton": "8", "Aguila": "9", "Tigre": "10",
    "Gato": "11", "Caballo": "12", "Mono": "13", "Paloma": "14", "Zorro": "15", "Oso": "16",
    "Pavo": "17", "Burro": "18", "Chivo": "19", "Cochino": "20", "Cerdo": "20", "Gallo": "21", "Camello": "22",
    "Cebra": "23", "Zebra": "23", "Iguana": "24", "Gallina": "25", "Vaca": "26", "Perro": "27", "Zamuro": "28",
    "Elefante": "29", "Caiman": "30", "Lapa": "31", "Ardilla": "32", "Pescado": "33", "Pez": "33", "Venado": "34",
    "Jirafa": "35", "Culebra": "36",
    # 37-75 (Extendida Guacharo / Monje)
    "Tortuga": "37", "Bufalo": "38", "Lechuza": "39", "Avispa": "40", "Canguro": "41", "Tucan": "42",
    "Mariposa": "43", "Chiguire": "44", "Garza": "45", "Puma": "46", "Pavo Real": "47", "Puercoespin": "48",
    "Pereza": "49", "Canario": "50", "Pelicano": "51", "Pulpo": "52", "Caracol": "53", "Grillo": "54",
    "Oso Hormiguero": "55", "Tiburon": "56", "Pato": "57", "Hormiga": "58", "Pantera": "59", "Camaleon": "60",
    "Panda": "61", "Cachicamo": "62", "Cangrejo": "63", "Gavilan": "64", "Araña": "65", "Lobo": "66",
    "Avestruz": "67", "Jaguar": "68", "Conejo": "69", "Bisonte": "70", "Guacamaya": "71", "Gorila": "72",
    "Hipopotamo": "73", "Turpial": "74", "Guacharo": "75", "Patrono": "75"
}

LOTERIAS = {
    "1": {"nombre": "Lotto Activo", "url_path": "lottoactivo", "json_key": "lottery_data_lotto", "filename": "sync_lotto.json"},
    "2": {"nombre": "La Granjita", "url_path": "lagranjita", "json_key": "lottery_data_granja", "filename": "sync_granja.json"},
    "3": {"nombre": "Selva Plus", "url_path": "selvaplus", "json_key": "lottery_data_selva", "filename": "sync_selva.json"},
    "4": {"nombre": "Lotto Activo 2", "url_path": "lottoactivo2(monjemillonario)", "json_key": "lottery_data_monje", "filename": "sync_monje.json"},
    "5": {"nombre": "Guacharo Activo", "url_path": "guacharoactivo", "json_key": "lottery_data_guacharo", "filename": "sync_guacharo.json"}
}

def normalize_string(s):
    replacements = (
        ("á", "a"), ("é", "e"), ("í", "i"), ("ó", "o"), ("ú", "u"),
        ("Á", "A"), ("É", "E"), ("Í", "I"), ("Ó", "O"), ("Ú", "U")
    )
    for a, b in replacements:
        s = s.replace(a, b).replace(a.upper(), b.upper())
    return s.strip()

def parse_time(time_str):
    m = re.match(r'(\d+):\d+\s+(AM|PM)', time_str.strip(), re.IGNORECASE)
    if not m: return None
    hour = int(m.group(1))
    ampm = m.group(2).upper()
    if ampm == 'PM' and hour != 12: hour += 12
    if ampm == 'AM' and hour == 12: hour = 0
    return str(hour)

def scrape_loteria(loteria_info, start_date, end_date):
    start = datetime.strptime(start_date, '%Y-%m-%d')
    end = datetime.strptime(end_date, '%Y-%m-%d')
    delta = end - start
    
    output_filename = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", loteria_info['filename'])
    export_data = {}
    if os.path.exists(output_filename):
        try:
            with open(output_filename, 'r') as f:
                export_data = json.load(f)
                if loteria_info['json_key'] in export_data:
                    export_data = export_data[loteria_info['json_key']]
        except:
            pass

    print(f"\nDescargando {loteria_info['nombre']} (Día por Día)...")
    dias_procesados = 0
    
    for i in range(delta.days + 1):
        day = start + timedelta(days=i)
        date_str = day.strftime('%Y-%m-%d')
        
        url = f"https://loteriadehoy.com/animalito/{loteria_info['url_path']}/resultados/{date_str}/"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        
        try:
            with urllib.request.urlopen(req) as response:
                html = response.read().decode('utf-8', errors='ignore')
        except Exception as e:
            continue
            
        matches = re.finditer(r'<h4[^>]*>([^<]+)</h4>\s*<h5[^>]*>([^<]+)</h5>', html, re.IGNORECASE)
        found_any = False
        
        for match in matches:
            animal_text = match.group(1).strip()
            time_text = match.group(2).strip()
            
            # Extraer los dígitos directamente del principio del texto (ej: "75 Patrono" -> "75", "00 Ballena" -> "00")
            animal_num_match = re.search(r'^(\d{1,2})', animal_text)
            animal_num = animal_num_match.group(1) if animal_num_match else None
                    
            if animal_num:
                time_match = re.search(r'(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))', time_text)
                if time_match:
                    time_str_parsed = parse_time(time_match.group(1).strip())
                    if time_str_parsed:
                        if date_str not in export_data:
                            export_data[date_str] = {}
                        export_data[date_str][time_str_parsed] = animal_num
                        found_any = True
                        
        if found_any:
            dias_procesados += 1
            
    if dias_procesados > 0:
        with open(output_filename, 'w') as f:
            json.dump(export_data, f, indent=2)
        print(f"  -> ¡Éxito! Archivo actualizado: {loteria_info['filename']} ({dias_procesados} días con datos extraídos)")
        return True
    else:
        print(f"  -> No se encontraron resultados nuevos para esta semana.")
        return False

# ─────────────────────────────────────────────────────────────────────────────
# MODO AUTOMÁTICO — usado por GitHub Actions (sin interacción del usuario)
# Ejecutar con:  python scripts/scraper.py --auto
# ─────────────────────────────────────────────────────────────────────────────
def auto_mode():
    """
    Descarga TODAS las loterías para el día de hoy y sube los resultados
    a GitHub automáticamente. Diseñado para ejecutarse desde GitHub Actions.

    El token de GitHub se lee desde la variable de entorno GITHUB_TOKEN
    (inyectada automáticamente por GitHub Actions).
    El repositorio se lee desde GH_REPO o usa el valor por defecto.
    """
    today = datetime.utcnow().strftime('%Y-%m-%d')  # GitHub Actions corre en UTC
    print(f"=== Modo Automático — Scraper Central de Loterías ===")
    print(f"Fecha a descargar: {today} (UTC)")
    print(f"Procesando TODAS las loterías...\n")

    # Leer credenciales del entorno (GitHub Actions las inyecta como secrets)
    token = os.environ.get("GITHUB_TOKEN", "")
    repo  = os.environ.get("GH_REPO", "Arafel-1/lotto-data")

    if not token:
        print("⚠️  ADVERTENCIA: No se encontró GITHUB_TOKEN en el entorno.")
        print("   Los datos se descargarán pero no se subirán a GitHub.")

    # Descargar todas las loterías solo para hoy
    loterias_exitosas = []
    for info in LOTERIAS.values():
        print(f"--- {info['nombre']} ---")
        ok = scrape_loteria(info, today, today)
        if ok:
            loterias_exitosas.append(info)

    print(f"\n✅ Descarga completada. {len(loterias_exitosas)}/{len(LOTERIAS)} loterías con datos nuevos.")

    # Subir a GitHub si hay token y datos
    if token and loterias_exitosas:
        print("\nSubiendo resultados a GitHub...")
        for info in loterias_exitosas:
            filepath = os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                "data", info['filename']
            )
            if os.path.exists(filepath):
                upload_to_github(filepath, repo, token)
    elif not loterias_exitosas:
        print("\nℹ️  No hay datos nuevos para subir (sorteos aún no publicados o sin conexión).")

    print("\nProceso automático finalizado.")


# ─────────────────────────────────────────────────────────────────────────────
# MODO INTERACTIVO — para uso manual desde la terminal del usuario
# ─────────────────────────────────────────────────────────────────────────────
def main():
    print("=== Sincronizador Central de Loterías ===")
    print("Elige una opción:")
    print("0) Extraer TODAS las loterías")
    for key, info in LOTERIAS.items():
        print(f"{key}) {info['nombre']}")
    
    opcion = input("\nOpción: ").strip()
    
    print("\n¿Cuántas semanas de historial deseas descargar?")
    print("0 = Solo esta semana (Por defecto)")
    print("1 = Esta semana y la anterior")
    print("2 = Esta semana y las 2 anteriores... etc")
    semanas_input = input("Ingresa un número (o presiona Enter para 0): ").strip()
    
    semanas = 0
    if semanas_input.isdigit():
        semanas = int(semanas_input)

    loterias_a_procesar = []
    if opcion == "0":
        loterias_a_procesar = list(LOTERIAS.values())
    elif opcion in LOTERIAS:
        loterias_a_procesar = [LOTERIAS[opcion]]
    else:
        print("Opción inválida.")
        return

    for info in loterias_a_procesar:
        print(f"\n--- Procesando: {info['nombre']} ---")
        for w in range(semanas + 1):
            start_date, end_date = get_week_dates(w)
            print(f"Buscando fechas: {start_date} al {end_date}")
            scrape_loteria(info, start_date, end_date)

    print("\n¿Deseas subir los archivos automáticamente a GitHub? (S/N)")
    subir = input("> ").strip().upper()
    if subir == 'S':
        config = load_github_config()
        repo = config.get("repo", "Arafel-1/lotto-data")
        token = config.get("token", "")
        
        if not token:
            print("\n--- Configuración de GitHub (Solo la primera vez) ---")
            print("Por favor, ingresa tu repositorio (Presiona Enter para Arafel-1/lotto-data):")
            repo_input = input(f"[{repo}]: ").strip()
            if repo_input: repo = repo_input
            
            print("Pega tu Personal Access Token de GitHub:")
            token = input("> ").strip()
            
            if token:
                save_github_config(repo, token)
        
        if token:
            print("\nIniciando subida a GitHub...")
            for info in loterias_a_procesar:
                filepath = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", info['filename'])
                if os.path.exists(filepath):
                    upload_to_github(filepath, repo, token)
        else:
            print("No se proporcionó un Token. Cancelando subida.")

    print("\nProceso finalizado.")
    input("Presiona Enter para salir...")

if __name__ == '__main__':
    # Si se pasa el argumento --auto, ejecutar en modo automático (GitHub Actions)
    if '--auto' in sys.argv:
        auto_mode()
    else:
        main()
