import urllib.request
import json

url = 'http://localhost:8080/api/restaurants'
req = urllib.request.urlopen(url)
rests = json.loads(req.read()).get('data', [])

print(f"Total restaurants: {len(rests)}")
for r in rests:
    rid = r.get('id')
    rname = r.get('name')
    ropen = r.get('open')
    rapproved = r.get('approved')
    menu_url = f"http://localhost:8080/api/restaurants/{rid}/menu"
    try:
        mreq = urllib.request.urlopen(menu_url)
        items = json.loads(mreq.read()).get('data', [])
        print(f"Restaurant: {rname} (ID: {rid}) | Open: {ropen} | Approved: {rapproved} | Menu items: {len(items)}")
        for it in items[:3]:
            print(f"   -> Item: {it.get('name')} (ID: {it.get('id')}) | Price: {it.get('price')} | AvailQty: {it.get('availableQuantity')}")
    except Exception as e:
        print(f"Restaurant: {rname} (ID: {rid}) | Error: {e}")
