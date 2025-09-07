# Notification System Documentation

## Overview

MediaNest follows the Unix philosophy of "do one thing well." This project provides a robust media management system but **does NOT include built-in email or notification services**. This is by design - self-hosters can integrate their preferred notification solution.

## Philosophy

We believe notification preferences are highly personal and context-dependent. Rather than forcing a specific email provider or notification system, MediaNest provides clean integration points for you to connect your preferred solution.

## For Self-Hosters

### Available Integration Points

MediaNest emits events for key system actions that you can hook into:

#### Authentication Events

- `auth.login` - User login (includes IP, user agent)
- `auth.logout` - User logout
- `auth.failed` - Failed login attempt
- `auth.password.changed` - Password change
- `auth.2fa.enabled` - 2FA enabled
- `auth.2fa.disabled` - 2FA disabled

#### User Management Events

- `user.created` - New user registration
- `user.updated` - User profile update
- `user.deleted` - User deletion
- `user.role.changed` - User role modification

#### Media Events

- `media.uploaded` - New media uploaded
- `media.processed` - Media processing complete
- `media.deleted` - Media deleted
- `media.shared` - Media shared with others

#### System Events

- `system.error` - System error occurred
- `system.backup.complete` - Backup completed
- `system.update.available` - Update available

### Integration Options

#### 1. Webhook Endpoints

MediaNest can POST event data to your webhook endpoints:

```javascript
// Configure in your .env file
WEBHOOK_URL=https://your-webhook-service.com/medianest
WEBHOOK_SECRET=your-webhook-secret

// Event payload format
{
  "event": "auth.login",
  "timestamp": "2025-01-07T12:00:00Z",
  "data": {
    "userId": "user123",
    "ip": "192.168.1.1",
    "userAgent": "Mozilla/5.0..."
  }
}
```

#### 2. Popular Notification Services

You can easily integrate these services via webhooks or their APIs:

**Email Services:**

- SendGrid - `npm install @sendgrid/mail`
- AWS SES - `npm install @aws-sdk/client-ses`
- Postmark - `npm install postmark`
- Mailgun - `npm install mailgun-js`
- SMTP - Any SMTP server via `nodemailer`

**Push Notifications:**

- Pushover - Simple push notifications
- Pushbullet - Cross-device notifications
- Gotify - Self-hosted push server
- ntfy - Simple HTTP-based pub-sub

**Chat Integrations:**

- Discord Webhooks - Team notifications
- Slack Webhooks - Workspace alerts
- Telegram Bot API - Personal notifications
- Matrix - Federated chat notifications

**Self-Hosted Solutions:**

- Apprise - Notification bridge supporting 80+ services
- n8n - Workflow automation with notifications
- Node-RED - Flow-based notification routing

#### 3. DIY Integration Example

Create a simple notification handler in `notifications/handler.js`:

```javascript
// Example: Discord webhook integration
const axios = require('axios');

async function sendDiscordNotification(event, data) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  const embed = {
    title: `MediaNest: ${event}`,
    description: formatEventMessage(event, data),
    color: getEventColor(event),
    timestamp: new Date().toISOString(),
  };

  await axios.post(webhookUrl, {
    embeds: [embed],
  });
}

// Listen to MediaNest events
eventEmitter.on('auth.failed', (data) => {
  if (data.attempts > 3) {
    sendDiscordNotification('Security Alert', data);
  }
});
```

### Password Reset Without Email

Since email-based password reset is disabled, MediaNest supports these alternatives:

1. **Admin Reset** - Administrators can reset user passwords via the admin panel
2. **Plex Authentication** - Primary authentication via Plex (no password needed)
3. **Recovery Codes** - Generate one-time recovery codes for users
4. **Security Questions** - Implement your own recovery mechanism

### Environment Variables

```bash
# Webhook Configuration (Optional)
WEBHOOK_URL=              # Your webhook endpoint
WEBHOOK_SECRET=           # Webhook signature secret
WEBHOOK_EVENTS=           # Comma-separated events to send

# Event System
EVENT_QUEUE_ENABLED=false # Enable Redis-based event queue
EVENT_QUEUE_REDIS_URL=    # Redis URL for event queue
```

## Security Considerations

1. **Webhook Security** - Always validate webhook signatures
2. **Rate Limiting** - Implement rate limiting on notification endpoints
3. **Sensitive Data** - Never include passwords or tokens in notifications
4. **Encryption** - Use HTTPS for all webhook endpoints
5. **Logging** - Log notification failures for debugging

## Frequently Asked Questions

**Q: Why doesn't MediaNest include email functionality?**
A: We follow the Unix philosophy - do one thing well. Notification preferences vary greatly between users, and we'd rather provide clean integration points than force a specific solution.

**Q: How do users reset their passwords without email?**
A: Users primarily authenticate via Plex. For admin accounts, administrators can reset passwords through the admin panel.

**Q: Can I add email functionality myself?**
A: Absolutely! The codebase is open source. You can fork the project and add any notification system you prefer.

**Q: What about 2FA without email?**
A: MediaNest supports TOTP (Time-based One-Time Password) 2FA using apps like Google Authenticator, Authy, or 1Password.

**Q: Will email support be added in the future?**
A: No. This is a deliberate design decision. We maintain clean integration points instead of built-in email support.

## Contributing

If you've created a notification integration for MediaNest, please consider:

1. Sharing it as a separate npm package
2. Adding it to our [Community Integrations](https://github.com/medianest/community-integrations) list
3. Writing a tutorial for other self-hosters

## Support

For questions about notification integration:

- Check existing [GitHub Discussions](https://github.com/medianest/discussions)
- Review the [webhook examples](./examples/webhooks/)
- Ask in our community channels

---

_MediaNest - Focus on media management, integrate your preferred notifications._
