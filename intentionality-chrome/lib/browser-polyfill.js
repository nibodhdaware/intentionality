(function (global, factory) {
    if (typeof define === "function" && define.amd) {
        define("webextension-polyfill", ["module"], factory);
    } else if (typeof exports !== "undefined") {
        factory(module);
    } else {
        var mod = {
            exports: {},
        };
        factory(mod);
        global.browser = mod.exports;
    }
})(
    typeof globalThis !== "undefined"
        ? globalThis
        : typeof self !== "undefined"
        ? self
        : this,
    function (module) {
        if (typeof browser === "undefined" && typeof chrome !== "undefined") {
            const apis = [
                "webNavigation",
                "tabs",
                "storage",
                "runtime",
                "notifications",
                "scripting",
            ];

            const browser = {};

            for (const api of apis) {
                browser[api] = {};

                // Convert callback-based APIs to promises
                for (const key in chrome[api]) {
                    if (typeof chrome[api][key] === "function") {
                        browser[api][key] = (...args) => {
                            return new Promise((resolve, reject) => {
                                chrome[api][key](...args, (result) => {
                                    if (chrome.runtime.lastError) {
                                        reject(chrome.runtime.lastError);
                                    } else {
                                        resolve(result);
                                    }
                                });
                            });
                        };
                    }
                }
            }

            // Special handling for event listeners
            apis.forEach((api) => {
                if (chrome[api]) {
                    Object.keys(chrome[api]).forEach((key) => {
                        if (key.startsWith("on")) {
                            browser[api][key] = chrome[api][key];
                        }
                    });
                }
            });

            module.exports = browser;
            (globalThis || self).browser = browser;
        }
    },
);
