// src/vora_wasm.cpp — Vora → WebAssembly bridge
// ============================================================================
// Compiles the Vora pipeline (Lexer → Parser → Compiler → VM) into a single
// WASM-exported function vora_run().  stdout/cerr are captured and returned
// as a JSON string: {"ok":true,"output":"..."} or {"ok":false,"error":"..."}.
//
// Build with Emscripten:
//   emcc -O3 -sEXPORTED_FUNCTIONS='["_vora_run","_malloc","_free"]' \
//        -sEXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
//        -I D:/Vora-lang/Vora/src -I D:/Vora-lang/Vora/include \
//        src/vora_wasm.cpp D:/Vora-lang/Vora/src/**/*.cpp -o build/vora_wasm.js
// ============================================================================

#include <cstdlib>
#include <iostream>
#include <sstream>
#include <string>

#include "vora.h"

using namespace vora;

// ============================================================================
// stdout / stderr capture
// ============================================================================

struct CaptureGuard {
    std::ostringstream outBuf;
    std::ostringstream errBuf;
    std::streambuf* oldCout = nullptr;
    std::streambuf* oldCerr = nullptr;

    CaptureGuard() {
        oldCout = std::cout.rdbuf(outBuf.rdbuf());
        oldCerr = std::cerr.rdbuf(errBuf.rdbuf());
    }

    ~CaptureGuard() {
        std::cout.rdbuf(oldCout);
        std::cerr.rdbuf(oldCerr);
    }

    std::string out() const { return outBuf.str(); }
    std::string err() const { return errBuf.str(); }
};

// ============================================================================
// JSON escaping helper (no nlohmann/json — keep it dependency-free)
// ============================================================================

static std::string jsonEscape(const std::string& s) {
    std::string r;
    r.reserve(s.size() + 16);
    for (char c : s) {
        switch (c) {
            case '"':  r += "\\\""; break;
            case '\\': r += "\\\\"; break;
            case '\n': r += "\\n";  break;
            case '\r': r += "\\r";  break;
            case '\t': r += "\\t";  break;
            default:   r += c;
        }
    }
    return r;
}

static std::string makeResult(bool ok, const std::string& output,
                                       const std::string& error) {
    std::string json = "{\"ok\":";
    json += ok ? "true" : "false";
    if (!output.empty()) {
        json += ",\"output\":\"";
        json += jsonEscape(output);
        json += '"';
    }
    if (!error.empty()) {
        json += ",\"error\":\"";
        json += jsonEscape(error);
        json += '"';
    }
    json += '}';
    return json;
}

// ============================================================================
// WASM-exported API
// ============================================================================

extern "C" {

// vora_run — compile + execute Vora source, return JSON result.
//
// Returns a malloc'd C string.  The caller (JS) must free it via
// Module._free(ptr).
//
// JSON result:
//   {"ok": true,  "output": "<stdout content>"}
//   {"ok": false, "error":  "<parse or runtime error>"}
const char* vora_run(const char* source) {
    CaptureGuard capture;

    std::string src(source);
    StderrErrorReporter reporter(src);
    Lexer lexer(src, reporter);
    auto tokens = lexer.scanTokens();

    Parser parser(tokens, reporter);
    parser.setSource(src);
    auto program = parser.parse();

    if (parser.hasError()) {
        std::string err = capture.err();
        if (err.empty()) err = "Parse errors detected";
        std::string json = makeResult(false, "", err);
        char* buf = static_cast<char*>(std::malloc(json.size() + 1));
        std::memcpy(buf, json.c_str(), json.size() + 1);
        return buf;
    }

    Compiler compiler(reporter);
    compiler.setSource(src);
    Chunk chunk = compiler.compile(program.get());

    if (compiler.hadError) {
        std::string err = capture.err();
        if (err.empty()) err = "Compilation failed";
        std::string json = makeResult(false, "", err);
        char* buf = static_cast<char*>(std::malloc(json.size() + 1));
        std::memcpy(buf, json.c_str(), json.size() + 1);
        return buf;
    }

    VM vm;
    vm.errorReporter = &reporter;

    // WASM has no filesystem by default — std/ modules are not loaded.
    // Set module dirs to dummy values; import will fail gracefully.
    vm.stdDir = "/std";
    vm.currentModuleDir = ".";

    // Pre-allocate global slots from compiler's interning table
    vm.initGlobals(compiler.getGlobalNames());

    // Register all builtins
    registerBuiltins(vm);

    // Override vora_os_shell: subprocess execution is not
    // available in WASM (no popen / _popen).
    vm.defineNative("vora_os_shell", 1,
        [](const std::vector<Value>&) -> Value {
            return nullptr;
        });

    InterpretResult result = vm.interpret(chunk);

    if (result != InterpretResult::OK) {
        std::string err = capture.err();
        if (err.empty()) err = "Runtime error";
        std::string json = makeResult(false, "", err);
        char* buf = static_cast<char*>(std::malloc(json.size() + 1));
        std::memcpy(buf, json.c_str(), json.size() + 1);
        return buf;
    }

    std::string output = capture.out();
    std::string json = makeResult(true, output, "");
    char* buf = static_cast<char*>(std::malloc(json.size() + 1));
    std::memcpy(buf, json.c_str(), json.size() + 1);
    return buf;
}

} // extern "C"
