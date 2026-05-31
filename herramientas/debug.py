import urllib.request
import re
from datetime import datetime

date_str = datetime.now().strftime('%Y-%m-%d')
LOTERIAS = [
    {"url": "lottoactivo", "name": "Lotto Activo"},
    {"url": "lagranjita", "name": "La Granjita"},
    {"url": "selvaplus", "name": "Selva Plus"},
    {"url": "lottoactivo2(monjemillonario)", "name": "Lotto Activo 2"},
    {"url": "guacharoactivo", "name": "Guacharo Activo"}
]

for lot in LOTERIAS:
    url = f"https://loteriadehoy.com/animalito/{lot['url']}/resultados/{date_str}/"
    print(f"\n--- {lot['name']} ---")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('utf-8', errors='ignore')
    except Exception as e:
        print("Error:", e)
        continue

    matches = re.finditer(r'<h4[^>]*>([^<]+)</h4>\s*<h5[^>]*>([^<]+)</h5>', html, re.IGNORECASE)
    found = 0
    for match in matches:
        animal_text = match.group(1).strip()
        time_text = match.group(2).strip()
        
        animal_num_match = re.search(r'^(\d{1,2})', animal_text)
        animal_num = animal_num_match.group(1) if animal_num_match else None
        
        if animal_num:
            time_match = re.search(r'(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))', time_text)
            if time_match:
                found += 1
            else:
                print(f"  Time failed to parse: {time_text}")
        else:
            print(f"  Animal failed to parse num: {animal_text}")

    print(f"Total found: {found}")
