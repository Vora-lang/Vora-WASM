// www/vora.js — Vora WASM JavaScript wrapper
// ============================================================================
// Usage:
//   <script type="module">
//     import VoraWasm from './vora.js';
//     await VoraWasm.init('./vora_wasm.js');
//     const { ok, output, error } = VoraWasm.run('print("hello")');
//   </script>
// ============================================================================

const VoraWasm = {
    /** @type {object|null} Emscripten module instance */
    _module: null,

    /** @type {Function|null} Cached cwrap'd vora_run */
    _voraRun: null,

    /**
     * Initialize the WASM module.
     * @param {string} [wasmUrl='vora_wasm.js']  URL to the Emscripten JS glue
     */
    async init(wasmUrl = 'vora_wasm.js') {
        // Emscripten's modularize export: the .js file exports a factory
        // function that returns a Promise<Module>.
        const ModuleFactory = (await import(wasmUrl)).default;
        this._module = await ModuleFactory();

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

export default VoraWasm;
