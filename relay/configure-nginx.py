#!/usr/bin/env python3
"""Serve Slopes over HTTPS and retain HTTP relay routes for existing players."""
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
source = path.read_text()
blocks = []
for match in re.finditer(r'\bserver\s*\{', source):
    depth = 1
    end = match.end()
    while depth and end < len(source):
        depth += (source[end] == '{') - (source[end] == '}')
        end += 1
    block = source[match.start():end]
    if not re.search(r'server_name\s+ski\.atik\.kr\s*;', block):
        continue
    blocks.append((match.start(), end, block))
if len(blocks) != 2:
    raise SystemExit(f'Expected two ski.atik.kr server blocks, found {len(blocks)}')
http = next(block for block in blocks if re.search(r'listen\s+80\b', block[2]))
https = next(block for block in blocks if re.search(r'listen\s+443\b', block[2]))
# An already migrated site has its full application routes in the TLS block.
if re.search(r'root\s+/var/www/ski;', https[2]):
    secure = https[2]
else:
    tls = re.findall(r'(?m)^\s*(?:ssl_\w+\s+[^;]+;|include\s+/etc/letsencrypt/[^;]+;)[^\n]*', https[2])
    if not any('ssl_certificate ' in line for line in tls):
        raise SystemExit('Missing existing TLS certificate configuration')
    secure = re.sub(r'(?m)^\s*listen\s+[^;]+;\n', '', http[2])
    secure = secure.replace('server {', 'server {\n  listen 443 ssl;\n' + '\n'.join(tls), 1)
if 'snippets/slopes-relay.conf' not in secure:
    secure = secure.replace('server_name ski.atik.kr;', 'server_name ski.atik.kr;\n  include /etc/nginx/snippets/slopes-relay.conf;', 1)
redirect = '''server {
  listen 80;
  listen [::]:80;
  server_name ski.atik.kr;
  include /etc/nginx/snippets/slopes-relay.conf;
  location / { return 301 https://$host$request_uri; }
}'''
edits = [(http[0], http[1], redirect), (https[0], https[1], secure)]
for start, end, block in reversed(edits):
    source = source[:start] + block + source[end:]
path.write_text(source)
