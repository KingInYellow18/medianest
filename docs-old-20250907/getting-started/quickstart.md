# Quick Start Guide

Get MediaNest up and running in just a few minutes with this streamlined setup guide.

## 🚀 5-Minute Setup

### Step 1: Download and Run

=== "Docker Compose (Easiest)"

    ```bash
    # Clone the repository
    git clone https://github.com/medianest/medianest.git
    cd medianest

    # Start MediaNest services
    docker-compose up -d
    ```

=== "Docker Run (Single Command)"

    ```bash
    docker run -d \
      --name medianest \
      -p 8080:8080 \
      -v medianest_data:/app/data \
      medianest/medianest:latest
    ```

=== "NPM (Development)"

    ```bash
    # Install CLI
    npm install -g @medianest/cli

    # Create new project
    medianest init my-media-library
    cd my-media-library

    # Start development server
    medianest dev
    ```

### Step 2: Access the Interface

Once running, open your browser to:

**🌐 [http://localhost:8080](http://localhost:8080)**

You should see the MediaNest welcome screen!

### Step 3: Initial Setup Wizard

MediaNest will guide you through the setup process:

1. **Create Admin Account** - Set up your administrator credentials
2. **Configure Storage** - Choose where to store your media files
3. **Set Processing Options** - Configure automatic media processing
4. **Import Existing Media** - Optional: Import from existing folders

## 📁 Adding Your First Media

### Via Web Interface

1. Click **"Add Media"** in the top navigation
2. Drag and drop files or click **"Browse Files"**
3. MediaNest will automatically:
   - Extract metadata
   - Generate thumbnails
   - Organize by date/type
   - Create searchable tags

### Via API

```bash
curl -X POST http://localhost:8080/api/v1/media \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/your/media.jpg" \
  -F "collection=my-photos"
```

### Via CLI

```bash
medianest upload ./my-photos/ --collection "Family Photos" --auto-tag
```

## 🔍 Your First Search

Try searching for your media:

1. Use the search bar at the top
2. Search by:
   - **Filename**: `vacation.jpg`
   - **Date**: `2024-01-15`
   - **Tags**: `#sunset #beach`
   - **Content**: `"mountain landscape"`

## 📊 Quick Overview

After adding some media, explore these features:

<div class="grid cards" markdown>

- **📈 Dashboard**

  ***

  View storage usage, recent uploads, and activity

- **📂 Collections**

  ***

  Organize media into themed collections

- **🏷️ Tags**

  ***

  Automatic and manual tagging system

- **👥 Sharing**

  ***

  Share collections with team members

</div>

## ⚙️ Essential Configuration

### Environment Variables

Create a `.env` file for basic configuration:

```env
# Database
DATABASE_URL=sqlite:///data/medianest.db

# Storage
STORAGE_PATH=/app/data/media
STORAGE_TYPE=local

# Security
JWT_SECRET=your-secret-key-here
ADMIN_EMAIL=admin@example.com

# Processing
ENABLE_AUTO_PROCESSING=true
MAX_FILE_SIZE=100MB
```

### Basic Settings

Access settings at: **Settings > General**

- **Media Storage Location**: Choose where files are stored
- **Processing Options**: Enable/disable automatic thumbnails, metadata extraction
- **User Permissions**: Set default permissions for new users
- **API Access**: Generate API tokens for integrations

## 🎯 Next Steps

Now that you're up and running:

1. **[Read the User Guide](../user-guides/)** - Learn advanced features
2. **[Explore the API](../api/)** - Integrate with other tools
3. **[Join the Community](https://github.com/medianest/medianest/discussions)** - Get help and share tips

## 🆘 Common Issues

!!! warning "Port Already in Use"
If port 8080 is busy, change it in `docker-compose.yml`:
`yaml
    ports:
      - "3000:8080"  # Use port 3000 instead
    `

!!! warning "Permission Denied"
On Linux, you might need to fix permissions:
`bash
    sudo chown -R $USER:$USER ./data
    `

!!! tip "Performance"
For better performance with large libraries: - Increase memory allocation: `MEMORY_LIMIT=2G` - Enable Redis caching: `REDIS_URL=redis://localhost:6379`

Need more help? Check our [Troubleshooting Guide](../troubleshooting/).

---

**🎉 Congratulations!** You're now running MediaNest. Ready to explore more? Check out our [User Guides](../user-guides/) next.
