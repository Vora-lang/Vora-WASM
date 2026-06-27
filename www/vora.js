// www/vora.js — Vora WASM JavaScript wrapper
// ============================================================================
// Usage (browser ESM):
//   import VoraWasm from './vora.js';
//   await VoraWasm.init('./vora_wasm.js');
//   const { ok, output, error } = VoraWasm.run('print("hello")');
//
// Usage (Node.js CJS):
//   const VoraWasm = require('./vora.js');
//   await VoraWasm.init('./vora_wasm.js');
//   VoraWasm.run('print("hello")');
// ============================================================================

const VoraWasm = {
    /** @type {object|null} Emscripten module instance */
    _module: null,

    /** @type {Function|null} Cached cwrap'd vora_run */
    _voraRun: null,

    /**
     * Initialize the WASM module.
     * @param {string} [wasmUrl='vora_wasm.js']  Path to the Emscripten JS glue
     * @returns {Promise<void>}
     */
    async init(wasmUrl = 'vora_wasm.js') {
        // The Emscripten build uses MODULARIZE=1, which wraps the code
        // in a factory function. The factory returns a Promise<Module>.
        let factory;
        if (typeof require !== 'undefined') {
            // Node.js: require returns the factory function directly
            factory = require(wasmUrl);
        } else {
            // Browser: dynamic import
            factory = (await import(wasmUrl)).default;
        }
        this._module = await factory();

        // Wrap vora_run for fast repeated calls.
        // cwrap auto-converts string ↔ UTF-8 and handles malloc/free.
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

    /**
     * Free the WASM module (releases memory).
     */
    destroy() {
        this._module = null;
        this._voraRun = null;
    }
};

// Support both ESM and CJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoraWasm;
}
export default VoraWasm;
