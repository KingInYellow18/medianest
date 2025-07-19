# MediaNest Nginx Production Dockerfile
# Optimized nginx image with security headers and performance tuning

FROM nginx:alpine

# Install additional packages for health checks
RUN apk add --no-cache curl

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx configuration
COPY nginx-prod.conf /etc/nginx/nginx.conf

# Copy custom error pages
COPY html/429.html /usr/share/nginx/html/429.html

# Create directories for logs and cache
RUN mkdir -p /var/log/nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx /var/cache/nginx

# Copy health check script
RUN echo '#!/bin/sh\ncurl -f http://localhost/nginx_status || exit 1' > /healthcheck.sh && \
    chmod +x /healthcheck.sh

# Security: Don't run as root
USER nginx

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD /healthcheck.sh

# Expose ports
EXPOSE 80 443

# Start nginx
CMD ["nginx", "-g", "daemon off;"]