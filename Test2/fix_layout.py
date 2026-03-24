import re

file_path = r'c:\Users\asmith\Desktop\carga-tank\Dashboard-Tuneles\Test2\dasboard.html'
with open(file_path, 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Remove borders and box-shadow to make it fully flat
html = re.sub(r'border:\s*1px\s*solid\s*[^;]+;', 'border: none;', html)
html = re.sub(r'border:\s*1px\s*solid\s*[^;!]+!important;', 'border: none !important;', html)
html = re.sub(r'box-shadow:\s*0\s*8px.*?!important;', 'box-shadow: none !important;', html)
html = re.sub(r'box-shadow:\s*0\s*12px.*?!important;', 'box-shadow: none !important;', html)

# 2. Control padding: Make sure .component and .card-kpi have strictly 24px and no extra weird margins that break the layout
# The previous CSS had: padding: 24px !important; which is correct, I'll ensure it remains.

# 3. Remove the broken literal text '\n\n'
html = html.replace("\\n\\n", "")
html = html.replace("\\n", "")

# 4. Remove the chart container PROMEDIO DE HORAS DE ENFRIAMIENTO POR TÚNELES
chart_container_regex = r'<div class="row"[^>]*>\s*<div class="col l12 m12 s12">\s*<div class="component">\s*<div class="title">\s*<span>PROMEDIO DE HORAS DE ENFRIAMIENTO POR T&Uacute;NELES</span>\s*</div>\s*<div id="chart-enfriamiento"></div>\s*</div>\s*</div>\s*</div>'
html = re.sub(chart_container_regex, '', html, flags=re.IGNORECASE)

# 5. Remove the Javascript block for chart-enfriamiento
# It starts with `<script>\s*var options = \{` and ends with `chart.render();\s*</script>`
js_regex = r'<script>\s*var options = \{\s*chart: \{\s*type: "area"[\s\S]*?var chart = new ApexCharts\(\s*document\.querySelector\("#chart-enfriamiento"\),\s*options[\s\S]*?chart\.render\(\);\s*</script>'
html = re.sub(js_regex, '', html)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(html)
