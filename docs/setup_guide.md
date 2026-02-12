# ShieldTech Pi4-Core Setup Guide

**Target System:** Raspberry Pi 4 (Pi4-Core)  
**OS:** Raspberry Pi OS (64-bit)  
**Purpose:** Database server + API backend + Device monitoring

---

## Step 1: Initial System Setup

### Update System
```bash
sudo apt update
sudo apt upgrade -y
sudo apt autoremove -y
```

### Set Timezone
```bash
sudo timedatectl set-timezone America/New_York
```

---

## Step 2: Install PostgreSQL 15

### Add PostgreSQL Repository
```bash
sudo apt install -y postgresql-common
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh
```

### Install PostgreSQL
```bash
sudo apt install -y postgresql-15 postgresql-contrib-15
```

### Create Database and User
```bash
sudo -i -u postgres
psql

CREATE DATABASE shieldtech;
CREATE USER shieldtech WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE shieldtech TO shieldtech;

\q
exit
```

---

## Step 3: Install Node.js 20
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Install Global Packages
```bash
sudo npm install -g pm2
```

---

## Step 4: Create Project Structure
```bash
mkdir -p ~/shieldtech-api
mkdir -p ~/shieldtech-monitor
mkdir -p ~/uploads
mkdir -p ~/logs
```

---

## Step 5: Set Up API Backend

### Initialize Project
```bash
cd ~/shieldtech-api
npm init -y
```

### Install Dependencies
```bash
npm install express @prisma/client bcrypt jsonwebtoken cors dotenv
npm install express-rate-limit helmet morgan
npm install --save-dev prisma typescript @types/node @types/express
```

### Create Environment File
```bash
nano .env
```
```env
PORT=3001
NODE_ENV=production
DATABASE_URL=postgresql://shieldtech:password@localhost:5432/shieldtech
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=1h
UPLOAD_DIR=/home/shieldtech/uploads
```

---

## Step 6: Configure PM2 for Auto-Start
```bash
pm2 startup
pm2 save
```

---

## Step 7: Set Up Automatic Backups

### Create Backup Script
```bash
nano ~/backup-db.sh
```
```bash
#!/bin/bash
BACKUP_DIR="/home/shieldtech/backups"
mkdir -p $BACKUP_DIR
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="shieldtech_backup_$TIMESTAMP.sql"
pg_dump -U shieldtech -h localhost shieldtech > "$BACKUP_DIR/$FILENAME"
gzip "$BACKUP_DIR/$FILENAME"
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```
```bash
chmod +x ~/backup-db.sh
```

### Schedule with Cron
```bash
crontab -e
```

Add:
```
0 2 * * * /home/shieldtech/backup-db.sh >> /home/shieldtech/logs/backup.log 2>&1
```

---

## Troubleshooting

### PostgreSQL Won't Start
```bash
sudo journalctl -u postgresql -n 50
sudo systemctl restart postgresql
```

### Node App Won't Start
```bash
pm2 logs shieldtech-api --lines 100
pm2 restart shieldtech-api
```
