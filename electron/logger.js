const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class Logger {
  constructor() {
    // Log file location: user's app data directory
    this.logDir = app ? app.getPath('userData') : path.join(__dirname, '../logs');
    this.logFile = path.join(this.logDir, 'markdown-clusterer.log');
    this.maxLogSize = 5 * 1024 * 1024; // 5MB max log size
    this.ensureLogDir();
  }

  ensureLogDir() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (err) {
      console.error('Failed to create log directory:', err);
    }
  }

  rotateLogIfNeeded() {
    try {
      if (fs.existsSync(this.logFile)) {
        const stats = fs.statSync(this.logFile);
        if (stats.size > this.maxLogSize) {
          const backupFile = this.logFile + '.old';
          if (fs.existsSync(backupFile)) {
            fs.unlinkSync(backupFile);
          }
          fs.renameSync(this.logFile, backupFile);
        }
      }
    } catch (err) {
      console.error('Failed to rotate log:', err);
    }
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    let logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (data) {
      if (data instanceof Error) {
        logEntry += `\n  Error: ${data.message}`;
        logEntry += `\n  Stack: ${data.stack}`;
      } else if (typeof data === 'object') {
        try {
          logEntry += `\n  Data: ${JSON.stringify(data, null, 2)}`;
        } catch {
          logEntry += `\n  Data: [Unable to stringify]`;
        }
      } else {
        logEntry += `\n  Data: ${data}`;
      }
    }
    
    return logEntry;
  }

  write(level, message, data = null) {
    const logEntry = this.formatMessage(level, message, data);
    
    // Always log to console
    if (level === 'error') {
      console.error(logEntry);
    } else if (level === 'warn') {
      console.warn(logEntry);
    } else {
      console.log(logEntry);
    }

    // Write to file
    try {
      this.rotateLogIfNeeded();
      fs.appendFileSync(this.logFile, logEntry + '\n\n');
    } catch (err) {
      console.error('Failed to write to log file:', err);
    }
  }

  info(message, data = null) {
    this.write('info', message, data);
  }

  warn(message, data = null) {
    this.write('warn', message, data);
  }

  error(message, data = null) {
    this.write('error', message, data);
  }

  debug(message, data = null) {
    if (process.env.NODE_ENV === 'development' || !app?.isPackaged) {
      this.write('debug', message, data);
    }
  }

  getLogPath() {
    return this.logFile;
  }

  // Get recent log entries for display in the app
  getRecentLogs(lines = 100) {
    try {
      if (!fs.existsSync(this.logFile)) {
        return 'No logs yet.';
      }
      const content = fs.readFileSync(this.logFile, 'utf-8');
      const allLines = content.split('\n');
      return allLines.slice(-lines).join('\n');
    } catch (err) {
      return `Failed to read logs: ${err.message}`;
    }
  }
}

module.exports = new Logger();
