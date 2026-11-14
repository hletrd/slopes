#!/usr/bin/env python3
"""Add relay locations while preserving the site's existing redirects and TLS."""
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
source = path.read_text()
insertion = '  include /etc/nginx/snippets/slopes-relay.conf;\n'
edits = []
for match in re.finditer(r'\bserver\s*\{', source):
    depth = 1
    end = match.end()
    while depth and end < len(source):
        depth += (source[end] == '{') - (source[end] == '}')
        end += 1
    block = source[match.start():end]
    if not re.search(r'server_name\s+ski\.atik\.kr\s*;', block):
        continue
    if 'snippets/slopes-relay.conf' in block:
        continue
    block = re.sub(r'(server_name\s+ski\.atik\.kr\s*;\n)', r'\1' + insertion, block, count=1)
    if re.search(r'listen\s+443\b', block):
        block = re.sub(r'(?m)^\s*return 301 http://\$host\$request_uri;',
                       '\n  location / { return 301 http://$host$request_uri; }', block, count=1)
    edits.append((match.start(), end, block))
if len(edits) not in (0, 2):
    raise SystemExit(f'Expected two ski.atik.kr server blocks, found {len(edits)}')
for start, end, block in reversed(edits):
    source = source[:start] + block + source[end:]
path.write_text(source)
