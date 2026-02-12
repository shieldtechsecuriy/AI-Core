const os = require('os');
const fs = require('fs').promises;
const path = require('path');

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            system: {},
            services: {},
            performance: {},
            alerts: []
        };
        this.thresholds = {
            cpuUsage: 80,
            memoryUsage: 85,
            responseTime: 5000,
            errorRate: 5
        };
        this.monitoring = false;
        this.interval = null;
    }

    async startMonitoring() {
        if (this.monitoring) return;
        
        this.monitoring = true;
        console.log('🔍 Performance Monitor: Starting system monitoring...');
        
        // Initial system scan
        await this.collectSystemMetrics();
        await this.scanServices();
        
        // Set up periodic monitoring
        this.interval = setInterval(async () => {
            await this.collectSystemMetrics();
            await this.analyzePerformance();
            await this.checkThresholds();
        }, 30000); // Every 30 seconds
        
        return this.getStatus();
    }

    async stopMonitoring() {
        this.monitoring = false;
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        console.log('⏹️ Performance Monitor: Monitoring stopped');
    }

    async collectSystemMetrics() {
        try {
            const cpus = os.cpus();
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            
            this.metrics.system = {
                timestamp: new Date().toISOString(),
                cpu: {
                    count: cpus.length,
                    model: cpus[0]?.model || 'Unknown',
                    usage: await this.getCPUUsage()
                },
                memory: {
                    total: Math.round(totalMem / 1024 / 1024), // MB
                    used: Math.round(usedMem / 1024 / 1024), // MB
                    free: Math.round(freeMem / 1024 / 1024), // MB
                    usage: Math.round((usedMem / totalMem) * 100)
                },
                uptime: Math.round(os.uptime()),
                loadAverage: os.loadavg(),
                platform: os.platform(),
                arch: os.arch()
            };
        } catch (error) {
            console.error('❌ Performance Monitor: Error collecting system metrics:', error.message);
        }
    }

    async getCPUUsage() {
        return new Promise((resolve) => {
            const startMeasure = this.cpuAverage();
            
            setTimeout(() => {
                const endMeasure = this.cpuAverage();
                const idleDifference = endMeasure.idle - startMeasure.idle;
                const totalDifference = endMeasure.total - startMeasure.total;
                const usage = 100 - ~~(100 * idleDifference / totalDifference);
                resolve(usage);
            }, 1000);
        });
    }

    cpuAverage() {
        const cpus = os.cpus();
        let idle = 0;
        let total = 0;
        
        cpus.forEach((cpu) => {
            for (let type in cpu.times) {
                total += cpu.times[type];
            }
            idle += cpu.times.idle;
        });
        
        return { idle: idle / cpus.length, total: total / cpus.length };
    }

    async scanServices() {
        try {
            const servicesPath = path.join(process.cwd(), 'src', 'services');
            const files = await fs.readdir(servicesPath);
            const serviceFiles = files.filter(file => file.endsWith('.service.js'));
            
            this.metrics.services = {
                count: serviceFiles.length,
                files: serviceFiles,
                lastScan: new Date().toISOString(),
                health: {}
            };
            
            // Check service health
            for (const file of serviceFiles) {
                const serviceName = file.replace('.service.js', '');
                this.metrics.services.health[serviceName] = await this.checkServiceHealth(file);
            }
        } catch (error) {
            console.error('❌ Performance Monitor: Error scanning services:', error.message);
        }
    }

    async checkServiceHealth(serviceFile) {
        try {
            const servicePath = path.join(process.cwd(), 'src', 'services', serviceFile);
            const stats = await fs.stat(servicePath);
            const content = await fs.readFile(servicePath, 'utf8');
            
            return {
                status: 'healthy',
                size: stats.size,
                lines: content.split('\n').length,
                lastModified: stats.mtime.toISOString(),
                hasErrors: content.includes('TODO') || content.includes('FIXME'),
                complexity: this.calculateComplexity(content)
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message,
                lastCheck: new Date().toISOString()
            };
        }
    }

    calculateComplexity(content) {
        const lines = content.split('\n').length;
        const functions = (content.match(/function|async|=>/g) || []).length;
        const conditions = (content.match(/if|else|switch|case|\?|&&|\|\|/g) || []).length;
        const loops = (content.match(/for|while|forEach|map|filter|reduce/g) || []).length;
        
        return {
            lines,
            functions,
            conditions,
            loops,
            score: Math.round((conditions + loops + functions) / lines * 100) || 0
        };
    }

    async analyzePerformance() {
        const metrics = this.metrics.system;
        const services = this.metrics.services;
        
        this.metrics.performance = {
            timestamp: new Date().toISOString(),
            score: this.calculatePerformanceScore(),
            recommendations: this.generateRecommendations(),
            trends: {
                cpuTrend: this.analyzeTrend('cpu'),
                memoryTrend: this.analyzeTrend('memory'),
                serviceTrend: this.analyzeTrend('services')
            }
        };
    }

    calculatePerformanceScore() {
        const cpu = this.metrics.system.cpu?.usage || 0;
        const memory = this.metrics.system.memory?.usage || 0;
        const services = this.metrics.services?.count || 0;
        
        let score = 100;
        
        // Deduct points for high resource usage
        if (cpu > 70) score -= (cpu - 70);
        if (memory > 80) score -= (memory - 80);
        
        // Factor in service complexity
        const avgComplexity = Object.values(this.metrics.services?.health || {})
            .reduce((sum, service) => sum + (service.complexity?.score || 0), 0) / services;
        
        if (avgComplexity > 20) score -= (avgComplexity - 20);
        
        return Math.max(0, Math.round(score));
    }

    generateRecommendations() {
        const recommendations = [];
        const cpu = this.metrics.system.cpu?.usage || 0;
        const memory = this.metrics.system.memory?.usage || 0;
        
        if (cpu > this.thresholds.cpuUsage) {
            recommendations.push({
                type: 'cpu',
                priority: 'high',
                message: `CPU usage is high (${cpu}%). Consider optimizing resource-intensive operations.`
            });
        }
        
        if (memory > this.thresholds.memoryUsage) {
            recommendations.push({
                type: 'memory',
                priority: 'high',
                message: `Memory usage is high (${memory}%). Check for memory leaks or optimize data structures.`
            });
        }
        
        // Check service complexity
        Object.entries(this.metrics.services?.health || {}).forEach(([name, health]) => {
            if (health.complexity?.score > 30) {
                recommendations.push({
                    type: 'complexity',
                    priority: 'medium',
                    message: `Service ${name} has high complexity (${health.complexity.score}%). Consider refactoring.`
                });
            }
            
            if (health.lines > 300) {
                recommendations.push({
                    type: 'size',
                    priority: 'low',
                    message: `Service ${name} is large (${health.lines} lines). Consider splitting into smaller modules.`
                });
            }
        });
        
        return recommendations;
    }

    analyzeTrend(metric) {
        // Simple trend analysis - in a real implementation, you'd store historical data
        return 'stable'; // Could be 'increasing', 'decreasing', 'stable', 'volatile'
    }

    async checkThresholds() {
        const alerts = [];
        const cpu = this.metrics.system.cpu?.usage || 0;
        const memory = this.metrics.system.memory?.usage || 0;
        
        if (cpu > this.thresholds.cpuUsage) {
            alerts.push({
                type: 'cpu_alert',
                severity: 'warning',
                message: `CPU usage exceeded threshold: ${cpu}% > ${this.thresholds.cpuUsage}%`,
                timestamp: new Date().toISOString()
            });
        }
        
        if (memory > this.thresholds.memoryUsage) {
            alerts.push({
                type: 'memory_alert',
                severity: 'warning',
                message: `Memory usage exceeded threshold: ${memory}% > ${this.thresholds.memoryUsage}%`,
                timestamp: new Date().toISOString()
            });
        }
        
        if (alerts.length > 0) {
            this.metrics.alerts.push(...alerts);
            // Keep only last 50 alerts
            if (this.metrics.alerts.length > 50) {
                this.metrics.alerts = this.metrics.alerts.slice(-50);
            }
            
            alerts.forEach(alert => {
                console.warn(`⚠️ Performance Alert: ${alert.message}`);
            });
        }
    }

    getStatus() {
        return {
            monitoring: this.monitoring,
            metrics: this.metrics,
            uptime: process.uptime(),
            lastUpdate: new Date().toISOString()
        };
    }

    getReport() {
        const report = {
            summary: {
                performanceScore: this.metrics.performance?.score || 0,
                systemHealth: this.getSystemHealth(),
                serviceCount: this.metrics.services?.count || 0,
                alertCount: this.metrics.alerts?.length || 0
            },
            system: this.metrics.system,
            services: this.metrics.services,
            performance: this.metrics.performance,
            recentAlerts: this.metrics.alerts?.slice(-10) || []
        };
        
        return report;
    }

    getSystemHealth() {
        const cpu = this.metrics.system.cpu?.usage || 0;
        const memory = this.metrics.system.memory?.usage || 0;
        
        if (cpu > 90 || memory > 95) return 'critical';
        if (cpu > 70 || memory > 80) return 'warning';
        return 'healthy';
    }

    async updateThresholds(newThresholds) {
        this.thresholds = { ...this.thresholds, ...newThresholds };
        console.log('📊 Performance Monitor: Thresholds updated:', this.thresholds);
    }

    async exportMetrics(format = 'json') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `performance-metrics-${timestamp}.${format}`;
        const data = this.getReport();
        
        try {
            if (format === 'json') {
                await fs.writeFile(filename, JSON.stringify(data, null, 2));
            } else if (format === 'csv') {
                const csv = this.convertToCSV(data);
                await fs.writeFile(filename, csv);
            }
            
            console.log(`📊 Performance Monitor: Metrics exported to ${filename}`);
            return filename;
        } catch (error) {
            console.error('❌ Performance Monitor: Export failed:', error.message);
            throw error;
        }
    }

    convertToCSV(data) {
        const headers = ['Timestamp', 'CPU Usage', 'Memory Usage', 'Performance Score', 'Alert Count'];
        const row = [
            new Date().toISOString(),
            data.system?.cpu?.usage || 0,
            data.system?.memory?.usage || 0,
            data.summary?.performanceScore || 0,
            data.summary?.alertCount || 0
        ];
        
        return [headers.join(','), row.join(',')].join('\n');
    }
}

module.exports = new PerformanceMonitor();