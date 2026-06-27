// www/vora.js — Vora WASM JavaScript wrapper
// ============================================================================
// Browser:  <script src="vora_wasm.js"></script>
//           <script src="vora.js"></script>
//           await VoraWasm.init();
//           const { ok, output, error } = VoraWasm.run('print("hello")');
//
// Node.js:  const VoraWasm = require('./vora.js');
//           await VoraWasm.init('./vora_wasm.js');
// ============================================================================

const VoraWasm = {
    /** @type {object|null} */
    _module: null,
    /** @type {Function|null} */
    _voraRun: null,

    /**
     * Initialize the WASM module.
     * @param {string} [wasmUrl='vora_wasm.js'] — only used in Node.js
     */
    async init(wasmUrl) {
        let factory;
        if (typeof globalThis.Module === 'function') {
            // Browser: loaded via <script>, factory is a global
            factory = globalThis.Module;
        } else if (typeof require !== 'undefined') {
            // Node.js: require returns the factory
            factory = require(wasmUrl || './vora_wasm.js');
        } else {
            throw new Error('Module not found. Load vora_wasm.js first.');
        }
        this._module = await factory();
        this._voraRun = this._module.cwrap('vora_run', 'string', ['string']);
    },

    /**
     * Execute Vora source code.
     * @param {string} source
     * @returns {{ok: boolean, output?: string, error?: string}}
     */
    run(source) {
        if (!this._module) {
            return { ok: false, error: 'VoraWasm not initialized. Call VoraWasm.init() first.' };
        }
        const json = this._voraRun(source);
        return JSON.parse(json);
    },

    destroy() {
        this._module = null;
        this._voraRun = null;
    }
};

// Browser global
if (typeof window !== 'undefined') {
    window.VoraWasm = VoraWasm;
}
// Node.js CJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoraWasm;
}
