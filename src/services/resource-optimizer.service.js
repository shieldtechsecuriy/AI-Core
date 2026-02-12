const { EventEmitter } = require('events');
const os = require('os');
const { exec } = require('child_process');
const fs = require('fs').promises;

class ResourceOptimizerService extends EventEmitter {
  constructor() {
    super();
    this.isRunning = false;
    this.optimizationInterval = null;
    this.thresholds = {
      cpu: 80, // CPU usage percentage
      memory: 85, // Memory usage percentage
      disk: 90, // Disk usage percentage
      processMemory: 500 * 1024 * 1024, // 500MB per process
      systemLoad: os.cpus().length * 0.8 // 80% of CPU cores
    };
    this.monitoringInterval = 30000; // 30 seconds
    this.criticalProcesses = ['openclaw', 'node', 'pm2'];
    this.optimizationHistory = [];
    this.maxHistorySize = 100;
  }

  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🔧 Resource Optimizer Engine starting...');
    
    // Initial system assessment
    await this.performSystemAssessment();
    
    // Start continuous monitoring
    this.optimizationInterval = setInterval(() => {
      this.monitorAndOptimize();
    }, this.monitoringInterval);
    
    this.emit('started');
  }

  async stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
    }
    
    console.log('🔧 Resource Optimizer Engine stopped');
    this.emit('stopped');
  }

  async performSystemAssessment() {
    try {
      const assessment = {
        timestamp: new Date(),
        cpu: await this.getCPUUsage(),
        memory: await this.getMemoryUsage(),
        disk: await this.getDiskUsage(),
        processes: await this.getProcessInfo(),
        systemLoad: os.loadavg(),
        uptime: os.uptime()
      };
      
      console.log('📊 System Assessment:', {
        cpu: `${assessment.cpu.toFixed(2)}%`,
        memory: `${assessment.memory.used.toFixed(2)}%`,
        disk: `${assessment.disk.used.toFixed(2)}%`,
        load: assessment.systemLoad[0].toFixed(2)
      });
      
      this.emit('assessment', assessment);
      return assessment;
    } catch (error) {
      console.error('❌ System assessment failed:', error.message);
      this.emit('error', error);
    }
  }

  async monitorAndOptimize() {
    try {
      const assessment = await this.performSystemAssessment();
      const optimizations = await this.determineOptimizations(assessment);
      
      if (optimizations.length > 0) {
        console.log(`🚀 Applying ${optimizations.length} optimizations...`);
        await this.applyOptimizations(optimizations);
      }
      
    } catch (error) {
      console.error('❌ Monitoring and optimization failed:', error.message);
      this.emit('error', error);
    }
  }

  async getCPUUsage() {
    return new Promise((resolve) => {
      const startMeasure = this.cpuAverage();
      setTimeout(() => {
        const endMeasure = this.cpuAverage();
        const idleDifference = endMeasure.idle - startMeasure.idle;
        const totalDifference = endMeasure.total - startMeasure.total;
        const percentageCPU = 100 - Math.floor(100 * idleDifference / totalDifference);
        resolve(percentageCPU);
      }, 1000);
    });
  }

  cpuAverage() {
    const cpus = os.cpus();
    let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;
    
    for (let cpu of cpus) {
      user += cpu.times.user;
      nice += cpu.times.nice;
      sys += cpu.times.sys;
      irq += cpu.times.irq;
      idle += cpu.times.idle;
    }
    
    const total = user + nice + sys + idle + irq;
    return { idle, total };
  }

  async getMemoryUsage() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    return {
      total: totalMem,
      free: freeMem,
      used: (usedMem / totalMem) * 100,
      usedBytes: usedMem
    };
  }

  async getDiskUsage() {
    return new Promise((resolve, reject) => {
      exec('df -h /', (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        
        const lines = stdout.split('\n');
        const dataLine = lines[1].split(/\s+/);
        const usedPercentage = parseInt(dataLine[4].replace('%', ''));
        
        resolve({
          used: usedPercentage,
          available: dataLine[3],
          total: dataLine[1]
        });
      });
    });
  }

  async getProcessInfo() {
    return new Promise((resolve, reject) => {
      exec('ps aux --sort=-%mem | head -20', (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        
        const lines = stdout.split('\n').slice(1);
        const processes = lines.map(line => {
          const parts = line.split(/\s+/);
          if (parts.length < 11) return null;
          
          return {
            pid: parts[1],
            cpu: parseFloat(parts[2]),
            memory: parseFloat(parts[3]),
            command: parts.slice(10).join(' '),
            user: parts[0]
          };
        }).filter(p => p !== null);
        
        resolve(processes);
      });
    });
  }

  async determineOptimizations(assessment) {
    const optimizations = [];
    
    // High CPU usage optimization
    if (assessment.cpu > this.thresholds.cpu) {
      optimizations.push({
        type: 'cpu_optimization',
        priority: 'high',
        action: 'reduce_cpu_intensive_processes',
        details: { currentCPU: assessment.cpu }
      });
    }
    
    // High memory usage optimization
    if (assessment.memory.used > this.thresholds.memory) {
      optimizations.push({
        type: 'memory_optimization',
        priority: 'critical',
        action: 'free_memory',
        details: { currentMemory: assessment.memory.used }
      });
    }
    
    // High disk usage optimization
    if (assessment.disk.used > this.thresholds.disk) {
      optimizations.push({
        type: 'disk_optimization',
        priority: 'high',
        action: 'cleanup_disk_space',
        details: { currentDisk: assessment.disk.used }
      });
    }
    
    // Process-specific optimizations
    const memoryHungryProcesses = assessment.processes.filter(p => 
      p.memory > 10 && !this.criticalProcesses.some(cp => p.command.includes(cp))
    );
    
    if (memoryHungryProcesses.length > 0) {
      optimizations.push({
        type: 'process_optimization',
        priority: 'medium',
        action: 'optimize_processes',
        details: { processes: memoryHungryProcesses }
      });
    }
    
    return optimizations;
  }

  async applyOptimizations(optimizations) {
    for (const optimization of optimizations) {
      try {
        await this.executeOptimization(optimization);
        this.recordOptimization(optimization);
      } catch (error) {
        console.error(`❌ Failed to apply optimization ${optimization.type}:`, error.message);
      }
    }
  }

  async executeOptimization(optimization) {
    switch (optimization.type) {
      case 'memory_optimization':
        await this.freeMemory();
        break;
        
      case 'cpu_optimization':
        await this.reduceCPULoad();
        break;
        
      case 'disk_optimization':
        await this.cleanupDiskSpace();
        break;
        
      case 'process_optimization':
        await this.optimizeProcesses(optimization.details.processes);
        break;
        
      default:
        console.warn(`Unknown optimization type: ${optimization.type}`);
    }
  }

  async freeMemory() {
    return new Promise((resolve) => {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      // Clear system caches (Linux)
      exec('sync && echo 1 > /proc/sys/vm/drop_caches 2>/dev/null || true', (error) => {
        if (!error) {
          console.log('💾 System memory caches cleared');
        }
        resolve();
      });
    });
  }

  async reduceCPULoad() {
    // Reduce process priorities for non-critical processes
    exec('renice +10 -p $(pgrep -f "node.*(?!openclaw)") 2>/dev/null || true', (error) => {
      if (!error) {
        console.log('⚡ Reduced CPU priority for non-critical processes');
      }
    });
  }

  async cleanupDiskSpace() {
    const cleanupCommands = [
      'find /tmp -type f -atime +7 -delete 2>/dev/null || true',
      'find /var/log -name "*.log" -type f -size +100M -delete 2>/dev/null || true',
      'npm cache clean --force 2>/dev/null || true'
    ];
    
    for (const command of cleanupCommands) {
      exec(command, (error) => {
        if (!error) {
          console.log('🧹 Disk cleanup completed for:', command.split(' ')[1]);
        }
      });
    }
  }

  async optimizeProcesses(processes) {
    // Kill processes using excessive memory (but not critical ones)
    for (const process of processes.slice(0, 3)) { // Limit to top 3
      if (process.memory > 20) { // More than 20% memory
        exec(`kill -TERM ${process.pid} 2>/dev/null || true`, (error) => {
          if (!error) {
            console.log(`🔄 Terminated memory-hungry process: ${process.command.substring(0, 50)}`);
          }
        });
      }
    }
  }

  recordOptimization(optimization) {
    const record = {
      timestamp: new Date(),
      type: optimization.type,
      priority: optimization.priority,
      action: optimization.action,
      details: optimization.details
    };
    
    this.optimizationHistory.push(record);
    
    // Keep history size manageable
    if (this.optimizationHistory.length > this.maxHistorySize) {
      this.optimizationHistory = this.optimizationHistory.slice(-this.maxHistorySize);
    }
    
    this.emit('optimization_applied', record);
  }

  getOptimizationHistory() {
    return this.optimizationHistory;
  }

  getSystemStatus() {
    return {
      isRunning: this.isRunning,
      thresholds: this.thresholds,
      recentOptimizations: this.optimizationHistory.slice(-10),
      uptime: process.uptime()
    };
  }

  updateThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    console.log('🎛️ Resource thresholds updated:', this.thresholds);
    this.emit('thresholds_updated', this.thresholds);
  }

  async emergencyOptimization() {
    console.log('🚨 Emergency optimization triggered!');
    
    // Force aggressive cleanup
    await Promise.all([
      this.freeMemory(),
      this.reduceCPULoad(),
      this.cleanupDiskSpace()
    ]);
    
    const assessment = await this.performSystemAssessment();
    this.emit('emergency_optimization', assessment);
    
    return assessment;
  }
}

module.exports = ResourceOptimizerService;