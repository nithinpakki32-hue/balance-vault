import os
import re

src_dir = 'client/src'
for root, dirs, files in os.walk(src_dir):
    for f in files:
        if f.endswith('.tsx') or f.endswith('.ts'):
            path = os.path.join(root, f).replace('\\', '/')
            with open(path, 'r', encoding='utf-8') as file:
                lines = file.readlines()
            
            content = ''.join(lines)
            
            # Check const x = / let x =
            for idx, line in enumerate(lines):
                # strip string literals and comments
                stripped = re.sub(r'//.*', '', line)
                var_match = re.search(r'(?:const|let)\s+([a-zA-Z0-9_]+)\s*=', stripped)
                if var_match:
                    var_name = var_match.group(1)
                    # Check how many times var_name appears as a word in the entire file
                    # excluding comments and strings if possible, or just word boundary
                    matches = [m.start() for m in re.finditer(r'\b' + re.escape(var_name) + r'\b', content)]
                    if len(matches) <= 1:
                        print(f"UNUSED VARIABLE in {path}:{idx+1}: '{var_name}'")
