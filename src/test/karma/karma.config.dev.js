process.env.CHROME_BIN = require('puppeteer').executablePath();
var files = require('../files');
module.exports = function (config) {
    config.set({
        basePath: '../../',
        frameworks: ['mocha', 'chai'],
        client: {
            mocha: {
                timeout: 60000
            }
        },
        files: ['output/jsstore.js', 'output/jsstore.worker.js',
            'output/jsstore.worker.ie.min.js', ...files.list_of_files
        ],
        proxies: {
            '/test/': '/base/test/',
            // '/scripts/': 'base/test/scripts/',
            // '/static/': 'base/test/static/',
            // '/cases/': 'base/cases/',
            '/output/': '/base/output/'
        },
        reporters: ['mocha'],
        port: 9876, // karma web server port
        colors: true,
        logLevel: config.LOG_INFO,
        browsers: ['HeadlessChrome'],
        customLaunchers: {
            HeadlessChrome: {
                base: 'ChromeHeadless',
                flags: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--headless',
                    '--disable-gpu',
                    '--disable-translate',
                    '--disable-extensions'
                ]
            }
        },
        autoWatch: false,
        concurrency: Infinity,
        // singleRun: false,
        singleRun: true,
        browserNoActivityTimeout: 120000,
    })
}