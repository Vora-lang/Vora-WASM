# Vora-WASM

Vora language runtime compiled to WebAssembly — run `.va` scripts in the browser.

Powered by [Emscripten](https://emscripten.org/), embeds the full Vora VM pipeline: lexer → parser → compiler → bytecode interpreter.

## Quick Start

### Prerequisites

- [Emscripten](https://emscripten.org/docs/getting_started/downloads.html) (`emcc` in PATH)

### Build

```bash
# Activate Emscripten
source /path/to/emsdk/emsdk_env.sh   # Linux/macOS
# or: emsdk activate

# Configure + build
cd Vora-WASM
emcmake cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build

# Output:
#   build/vora_wasm.js     (Emscripten glue)
#   build/vora_wasm.wasm   (WASM binary)
```

### Run the playground

```bash
# Serve the www/ directory (any HTTP server works)
python -m http.server 8000 -d www
# or: npx serve www

# Open http://localhost:8000 in a browser
```

Copy `build/vora_wasm.js` and `build/vora_wasm.wasm` into `www/` first, or adjust the script path in `index.html`.

## API

```js
import VoraWasm from './vora.js';

await VoraWasm.init('./vora_wasm.js');

const { ok, output, error } = VoraWasm.run('print("hello")');
// → { ok: true, output: "hello\n" }
```

### `VoraWasm.init(wasmUrl?)`

Load the Emscripten WASM module. Must be called once before `run()`.

### `VoraWasm.run(source)`

Execute Vora source code. Returns:

- `{ ok: true, output: "..." }` — success, with captured stdout
- `{ ok: false, error: "..." }` — parse error, compile error, or runtime error

## Repository structure

```
Vora-WASM/
├── src/
│   └── vora_wasm.cpp        # C bridge: vora_run() entry point
├── www/
│   ├── index.html            # Browser playground
│   └── vora.js               # JS wrapper API
├── CMakeLists.txt            # Emscripten build
├── LICENSE
└── README.md
```

## How it works

```
JS (browser)
  │ vora.js
  │ VoraWasm.run(source)
  ▼
C bridge (vora_wasm.cpp)
  │ vora_run(const char* src)
  │   ├─ Capture stdout/cerr → ostringstream
  │   ├─ Lexer → Parser → Compiler → VM
  │   └─ Return JSON: {ok, output?, error?}
  ▼
Vora core (lexer, parser, compiler, VM)
```

## Status

| Feature | Status |
|---------|--------|
| Single-shot execution (`vora_run`) | ✅ |
| Browser playground | ✅ |
| `import` / stdlib | 🔜 P1 |
| REPL / incremental execution | 🔜 |
| Vora ↔ JS bidirectional calls | 🔜 |

## License

MIT — see the main [Vora](https://github.com/Vora-lang/Vora) repository.
