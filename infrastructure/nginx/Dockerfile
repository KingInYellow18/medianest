# MediaNest Nginx Production Dockerfile
# Optimized nginx image with SSL/TLS support and security hardening

FROM nginx:alpine

# Install additional packages for health checks and SSL
RUN apk add --no-cache curl openssl

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Create necessary directories
RUN mkdir -p /var/log/nginx /var/cache/nginx /etc/nginx/ssl /var/www/certbot && \
    chown -R nginx:nginx /var/log/nginx /var/cache/nginx

# Generate DH parameters for enhanced SSL security (this takes a while)
RUN openssl dhparam -out /etc/nginx/ssl/dhparam.pem 2048

# Copy custom nginx configuration template
COPY nginx.prod.conf /etc/nginx/nginx.conf.template

# Copy custom error pages
COPY html/429.html /usr/share/nginx/html/429.html
COPY html/404.html /usr/share/nginx/html/404.html
COPY html/50x.html /usr/share/nginx/html/50x.html

# Create startup script that substitutes environment variables
RUN echo '#!/bin/sh' > /docker-entrypoint.sh && \
    echo 'set -e' >> /docker-entrypoint.sh && \
    echo '' >> /docker-entrypoint.sh && \
    echo '# Substitute environment variables in nginx config' >> /docker-entrypoint.sh && \
    echo 'envsubst "\$DOMAIN_NAME" < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf' >> /docker-entrypoint.sh && \
    echo '' >> /docker-entrypoint.sh && \
    echo '# Start nginx' >> /docker-entrypoint.sh && \
    echo 'exec nginx -g "daemon off;"' >> /docker-entrypoint.sh && \
    chmod +x /docker-entrypoint.sh

# Health check script
RUN echo '#!/bin/sh\ncurl -f http://localhost/nginx_status || exit 1' > /healthcheck.sh && \
    chmod +x /healthcheck.sh

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD /healthcheck.sh

# Expose ports
EXPOSE 80 443

# Use our custom entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]