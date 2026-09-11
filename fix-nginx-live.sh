#!/bin/bash
# Fixes Nginx 413 Request Entity Too Large and improves upload speed for Manch24
# Run this on your live server (65.1.107.153)

echo "Fixing Nginx upload limits and speed..."

# 1. Update the main nginx.conf
sudo sed -i '/http {/a \    client_max_body_size 10G;' /etc/nginx/nginx.conf

# 2. Add configuration to your site's Nginx config if it exists
SITE_CONF="/etc/nginx/sites-available/default"
if [ -f "/etc/nginx/sites-available/manch24" ]; then
    SITE_CONF="/etc/nginx/sites-available/manch24"
elif [ -f "/etc/nginx/sites-available/triple-minds" ]; then
    SITE_CONF="/etc/nginx/sites-available/triple-minds"
fi

if [ -f "$SITE_CONF" ]; then
    echo "Updating $SITE_CONF..."
    # Ensure client_max_body_size is 10G
    sudo sed -i 's/client_max_body_size .*/client_max_body_size 10G;/g' $SITE_CONF
    
    # Disable buffering for faster uploads and preventing disk/timeout errors
    if ! grep -q "proxy_request_buffering off;" $SITE_CONF; then
        sudo sed -i '/proxy_pass/a \        proxy_buffering off;\n        proxy_request_buffering off;' $SITE_CONF
    fi
fi

# 3. Test and reload Nginx
echo "Testing Nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "Reloading Nginx..."
    sudo systemctl reload nginx
    echo "✅ Success! Large uploads should now work with better speed and no 413 errors."
else
    echo "❌ Nginx configuration test failed. Please check your config."
fi
