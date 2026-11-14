#!/bin/sh
# Run from the deployment root on atik.kr after checking the internal relay.
set -eu
test -f relay/nginx.conf
attempt=0
until curl -fsS http://127.0.0.1:8790/healthz >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 10 ]; then
        echo 'Relay did not become ready within 10 seconds' >&2
        exit 1
    fi
    sleep 1
done
backup_dir=/var/backups/slopes-relay
backup_name="default-$(date +%Y%m%d-%H%M%S).conf"
sudo install -d -m 0755 "$backup_dir"
sudo cp -a /etc/nginx/sites-enabled/default "$backup_dir/$backup_name"
sudo cat /etc/nginx/sites-enabled/default > nginx-default.candidate
python3 relay/configure-nginx.py nginx-default.candidate
sudo install -m 0644 relay/nginx-limits.conf /etc/nginx/conf.d/slopes-relay-limits.conf
sudo install -m 0644 relay/nginx.conf /etc/nginx/snippets/slopes-relay.conf
sudo install -m 0644 nginx-default.candidate /etc/nginx/sites-enabled/default
if sudo nginx -t; then
    sudo systemctl reload nginx
    echo "NGINX relay enabled; previous site config: $backup_dir/$backup_name"
else
    sudo cp -a "$backup_dir/$backup_name" /etc/nginx/sites-enabled/default
    exit 1
fi
