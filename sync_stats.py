#!/usr/bin/env python3
"""
Werkt kills en deaths in spelers.json bij vanuit de statistieken van je Minecraft-server.

Gebruik (op de computer waar de server draait):
  python sync_stats.py --server "C:\\minecraft\\server" --json "C:\\pad\\naar\\StudentenSMP\\spelers.json"
  python sync_stats.py --server /home/mc/server --json ~/StudentenSMP/spelers.json --push

--server  map waar server.properties en de wereld in staan
--json    het spelers.json-bestand van je website
--wereld  naam van de wereldmap (standaard: level-name uit server.properties)
--push    commit en push spelers.json naar GitHub (de map moet een git-repo zijn)

Wat het script doet:
  * leest <wereld>/stats/<uuid>.json voor kills en deaths
  * zoekt de naam bij elke uuid in usercache.json (anders bij Mojang)
  * nieuwe spelers worden toegevoegd (zonder team, vul dat zelf in)
  * team en "dood" blijven zoals jij ze hebt ingevuld, die verandert het script nooit
"""
import argparse, json, os, subprocess, sys, urllib.request

def lees_json(pad, standaard):
    try:
        with open(pad, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return standaard

def wereldnaam(server):
    try:
        with open(os.path.join(server, "server.properties"), encoding="utf-8") as f:
            for regel in f:
                if regel.startswith("level-name="):
                    return regel.split("=", 1)[1].strip()
    except OSError:
        pass
    return "world"

def naam_van_mojang(uuid):
    try:
        url = "https://sessionserver.mojang.com/session/minecraft/profile/" + uuid.replace("-", "")
        with urllib.request.urlopen(url, timeout=10) as r:
            return json.load(r).get("name")
    except Exception:
        return None

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--server", required=True)
    p.add_argument("--json", required=True)
    p.add_argument("--wereld")
    p.add_argument("--push", action="store_true")
    a = p.parse_args()

    wereld = a.wereld or wereldnaam(a.server)
    statsmap = os.path.join(a.server, wereld, "stats")
    if not os.path.isdir(statsmap):
        sys.exit("Map niet gevonden: " + statsmap)

    namen = {e["uuid"].lower(): e["name"] for e in lees_json(os.path.join(a.server, "usercache.json"), []) if "uuid" in e}
    spelers = lees_json(a.json, [])
    index = {s["naam"].lower(): s for s in spelers}
    veranderd = False

    for bestand in sorted(os.listdir(statsmap)):
        if not bestand.endswith(".json"):
            continue
        uuid = bestand[:-5].lower()
        stats = lees_json(os.path.join(statsmap, bestand), {}).get("stats", {}).get("minecraft:custom", {})
        kills = int(stats.get("minecraft:player_kills", 0))
        deaths = int(stats.get("minecraft:deaths", 0))
        naam = namen.get(uuid) or naam_van_mojang(uuid)
        if not naam:
            print("Naam niet gevonden voor", uuid, "(overgeslagen)")
            continue
        s = index.get(naam.lower())
        if s is None:
            s = {"naam": naam}
            spelers.append(s); index[naam.lower()] = s
            veranderd = True
        if s.get("kills") != kills or s.get("deaths") != deaths:
            s["kills"], s["deaths"] = kills, deaths
            veranderd = True

    if not veranderd:
        print("Geen veranderingen.")
        return
    with open(a.json, "w", encoding="utf-8") as f:
        json.dump(spelers, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("spelers.json bijgewerkt (" + str(len(spelers)) + " spelers).")

    if a.push:
        map_ = os.path.dirname(os.path.abspath(a.json))
        subprocess.run(["git", "add", os.path.basename(a.json)], cwd=map_, check=True)
        subprocess.run(["git", "commit", "-m", "Statistieken bijgewerkt"], cwd=map_, check=True)
        subprocess.run(["git", "push"], cwd=map_, check=True)
        print("Gepusht naar GitHub.")

if __name__ == "__main__":
    main()
