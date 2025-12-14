## 1. Prerequisites
- Nginx
- PHP-FPM (for `report.php`)

## 2. Directory Structure
Ensure the code is deployed to `/var/www/ski`.
```bash
/var/www/ski/
├── index.html
├── links.json
├── preview.png
├── WespJSSDKEncV4.min.js
├── sitemap.xml
├── videos+ld.json
├── weather.grid.json
├── weather.json
├── report.php
├── secrets.json
```

## 3. Nginx Configuration


```nginx
server {
  listen 80;
  listen [::]:80;

  server_name ski.atik.kr;

  root /var/www/ski;

  gzip on;
  gzip_comp_level 9;
  gzip_min_length 256;
  gzip_proxied any;
  gzip_vary on;

  gzip_types
  text/plain
  text/css
  text/xml
  text/javascript
  application/javascript
  application/x-javascript
  application/json
  application/xml
  application/xhtml+xml
  application/rss+xml
  application/atom_xml
  application/font-woff
  application/font-woff2
  application/vnd.ms-fontobject
  font/ttf
  font/otf
  image/svg+xml;

  location ~ /\. {
    deny all;
  }
  location ~ \.pem$ {
    deny all;
  }
  location ~ ^/(secrets\.json|secrets\.example\.json)$ {
    deny all;
  }

  location = /WespJSSDKEncV4.min.js {
    try_files $uri =404;
  }

  location ~ ^/(links\.json|preview\.png|weather\.json|videos\+ld\.json|sitemap\.xml|weather\.grid\.json)$ {
    try_files $uri =404;
  }

  location ~ ^/(links\.json|preview\.png|weather\.json|videos\+ld\.json|sitemap\.xml|weather\.grid\.json)\?(.*)$ {
    try_files $uri =404;
  }

  location ~ ^/stream_proxy/(?P<prot>https?)\/(?P<allowed_host>[^/]+)(?P<uri_proxy>/.*)$ {
    if ($allowed_host !~* ^(konjiam\.live\.cdn\.cloudn\.co\.kr|59\.30\.12\.195:1935|118\.46\.149\.144:8080|sn\.rtsp\.me)$) {
      return 403;
    }

    set $target_url "$prot://$allowed_host$uri_proxy";

    proxy_set_header Host $allowed_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

    proxy_pass $target_url;

    proxy_buffering on;
    proxy_cache stream_cache;
    proxy_cache_valid 200 302 1s;
    proxy_cache_valid 404 1m;
  }

  location = /report.php {
    include snippets/fastcgi-php.conf;
    fastcgi_pass unix:/run/php/php8.3-fpm.sock;
    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    include fastcgi_params;
  }

  location / {
    proxy_pass https://hletrd.github.io/slopes/;
    proxy_ssl_server_name on;
    proxy_set_header Host hletrd.github.io;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    add_header Access-Control-Allow-Origin * always;
    add_header Access-Control-Allow-Methods 'GET, POST, OPTIONS, PUT, DELETE, PATCH' always;
    add_header Access-Control-Allow-Headers '*' always;
    add_header Access-Control-Allow-Credentials true always;

    add_header Cross-Origin-Resource-Policy cross-origin always;
    add_header Cross-Origin-Embedder-Policy require-corp always;
    add_header Cross-Origin-Opener-Policy same-origin always;
  }
}
```