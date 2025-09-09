FROM nginx:1.25-alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Copy custom nginx configuration
COPY nginx-prod.conf /etc/nginx/nginx.conf

# Create required directories
RUN mkdir -p /var/cache/nginx /var/log/nginx /etc/nginx/ssl

# Set proper permissions
RUN chown -R nginx:nginx /var/cache/nginx /var/log/nginx

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost/nginx_status || exit 1

# Expose ports
EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]