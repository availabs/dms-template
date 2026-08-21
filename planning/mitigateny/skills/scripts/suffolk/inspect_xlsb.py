import sys, json
from pyxlsb import open_workbook

path = sys.argv[1]
maxrows = int(sys.argv[2]) if len(sys.argv) > 2 else 3
sheet_filter = sys.argv[3] if len(sys.argv) > 3 else None

with open_workbook(path) as wb:
    print("SHEETS:", wb.sheets)
    for name in wb.sheets:
        if sheet_filter and sheet_filter.lower() not in name.lower():
            continue
        print("\n=== SHEET:", name, "===")
        with wb.get_sheet(name) as sheet:
            for i, row in enumerate(sheet.rows()):
                if i >= maxrows:
                    break
                vals = [c.v for c in row]
                # trim trailing Nones
                while vals and vals[-1] is None:
                    vals.pop()
                print(f"[r{i}] n={len(vals)}", json.dumps(vals, default=str)[:6000])
