import os
import re

def build_portable():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    index_path = os.path.join(base_dir, "index.html")
    output_path = os.path.join(base_dir, "lottery_portable.html")

    print(f"Reading {index_path}...")
    with open(index_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Inline CSS
    # Regex to find <link rel="stylesheet" href="...">
    # We handle cases with or without quotes, and potentially extra attributes
    css_pattern = re.compile(r'<link[^>]+rel=["\']stylesheet["\'][^>]+href=["\']([^"\']+)["\'][^>]*>', re.IGNORECASE)
    
    def repl_css(match):
        href = match.group(1)
        css_path = os.path.join(base_dir, href)
        if os.path.exists(css_path):
            print(f"Inlining CSS: {href}")
            try:
                with open(css_path, 'r', encoding='utf-8') as f:
                    css_content = f.read()
            except UnicodeDecodeError:
                with open(css_path, 'r', encoding='latin-1') as f:
                    css_content = f.read()
            return f'<style>\n/* Source: {href} */\n{css_content}\n</style>'
        else:
            print(f"Warning: CSS file not found: {href}")
            return match.group(0)

    content = css_pattern.sub(repl_css, content)

    # 2. Inline JS
    # Regex to find <script src="..."></script>
    js_pattern = re.compile(r'<script[^>]+src=["\']([^"\']+)["\'][^>]*>\s*</script>', re.IGNORECASE)

    def repl_js(match):
        src = match.group(1)
        # Remove query parameters if any (e.g., app.js?v=1.0.12)
        clean_src = src.split('?')[0]
        js_path = os.path.join(base_dir, clean_src)
        
        if os.path.exists(js_path):
            print(f"Inlining JS: {clean_src}")
            try:
                with open(js_path, 'r', encoding='utf-8') as f:
                    js_content = f.read()
            except UnicodeDecodeError:
                with open(js_path, 'r', encoding='latin-1') as f:
                    js_content = f.read()
            return f'<script>\n// Source: {clean_src}\n{js_content}\n</script>'
        else:
            print(f"Warning: JS file not found: {clean_src}")
            return match.group(0)

    content = js_pattern.sub(repl_js, content)

    print(f"Writing portable file to {output_path}...")
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("Done!")

if __name__ == "__main__":
    build_portable()
