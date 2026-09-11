#!/bin/bash
# Fixes Nginx 413 on manch24.com and other site configs.
# Run on the live server (65.1.107.153), then reload nginx.
#   sudo bash api-server/fix-nginx-live.sh

set -euo pipefail

echo "Raising Nginx upload limit to 10G..."

MAIN_CONF="/etc/nginx/nginx.conf"
if [ -f "$MAIN_CONF" ]; then
  if grep -q "client_max_body_size" "$MAIN_CONF"; then
    sudo sed -i 's/client_max_body_size .*/client_max_body_size 10G;/' "$MAIN_CONF"
  else
    sudo sed -i '/http {/a \    client_max_body_size 10G;' "$MAIN_CONF"
  fi
fi

SNIPPET_FILE="/etc/nginx/conf.d/manch24-uploads.conf"
sudo tee "$SNIPPET_FILE" >/dev/null <<'EOF'
# Shared by all manch24 server blocks once included, or as a global http override.
client_max_body_size 10G;
client_body_timeout 3600s;
client_header_timeout 300s;
send_timeout 3600s;
EOF

mapfile -t SITE_CONFS < <(find /etc/nginx/sites-available /etc/nginx/sites-enabled /etc/nginx/conf.d -type f \( -name '*.conf' -o -name 'default' -o -name 'manch24' -o -name 'triple-minds' \) 2>/dev/null | sort -u)

for SITE_CONF in "${SITE_CONFS[@]}"; do
  [ -f "$SITE_CONF" ] || continue
  echo "Updating $SITE_CONF"

  if grep -q "client_max_body_size" "$SITE_CONF"; then
    sudo sed -i 's/client_max_body_size .*/client_max_body_size 10G;/' "$SITE_CONF"
  else
    sudo sed -i '/server {/a \    client_max_body_size 10G;' "$SITE_CONF"
  fi

  if ! grep -q "proxy_request_buffering off;" "$SITE_CONF"; then
    sudo sed -i '/proxy_pass/a \        proxy_buffering off;\n        proxy_request_buffering off;\n        proxy_read_timeout 3600s;\n        proxy_send_timeout 3600s;\n        client_max_body_size 10G;' "$SITE_CONF"
  fi
done

echo "Testing Nginx..."
sudo nginx -t
sudo systemctl reload nginx
echo "Nginx reload complete. Large proxy uploads should no longer return 413."
