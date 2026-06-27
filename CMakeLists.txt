cmake_minimum_required(VERSION 3.16)
project(VoraWasm VERSION 0.1.0)

# ============================================================================
# Vora core source directory
# ============================================================================
# Override with -DVORA_SRC_DIR=... on the command line.
if(NOT DEFINED VORA_SRC_DIR)
    # Default: sibling directory ../Vora/src
    get_filename_component(VORA_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/../Vora" ABSOLUTE)
    set(VORA_SRC_DIR "${VORA_ROOT}/src")
endif()

# VORA_ROOT is one level above VORA_SRC_DIR (the Vora repo root)
get_filename_component(VORA_ROOT "${VORA_SRC_DIR}" DIRECTORY)

message(STATUS "Vora source directory: ${VORA_SRC_DIR}")
message(STATUS "Vora include directory: ${VORA_ROOT}/include")

# ============================================================================
# Vora core sources (subset)
# ============================================================================
# We include the language runtime but exclude:
#   - src/main.cpp        (desktop CLI entry point)
#   - src/lsp/            (semantic analyzer — not needed for runtime)
#   - src/json_rpc/       (LSP JSON-RPC transport)
#   - src/formatter/      (code formatter — vora fmt)
#   - src/vm/vm.cpp contains std::getenv calls for $VAR expansion in
#     import paths. These are harmless under Emscripten (return NULL).

file(GLOB VORA_SOURCES
    "${VORA_SRC_DIR}/lexer/*.cpp"
    "${VORA_SRC_DIR}/ast/*.cpp"
    "${VORA_SRC_DIR}/parser/*.cpp"
    "${VORA_SRC_DIR}/vm/*.cpp"
    "${VORA_SRC_DIR}/runtime/*.cpp"
    "${VORA_SRC_DIR}/common/*.cpp"
    "${VORA_SRC_DIR}/gc/*.cpp"
)

# ============================================================================
# WASM executable
# ============================================================================
add_executable(vora_wasm
    src/vora_wasm.cpp
    ${VORA_SOURCES}
)

target_include_directories(vora_wasm PRIVATE
    "${VORA_SRC_DIR}"
    "${VORA_ROOT}/include"
)

target_compile_features(vora_wasm PRIVATE cxx_std_17)

# Suppress nlohmann/json warnings (unused-includes, etc.) in third-party code
target_compile_options(vora_wasm PRIVATE
    -Wno-unused-parameter
    -Wno-unused-variable
)

# ============================================================================
# Emscripten link flags
# ============================================================================
# Use target_link_options — LINK_FLAGS mangles -s flags containing commas.
target_link_options(vora_wasm PRIVATE
    "-sEXPORTED_FUNCTIONS=[_vora_run,_malloc,_free]"
    "-sEXPORTED_RUNTIME_METHODS=[ccall,cwrap]"
    "-sENVIRONMENT=web,worker,node"
    "-sALLOW_MEMORY_GROWTH=1"
    "-sINITIAL_MEMORY=16MB"
    "-sMAXIMUM_MEMORY=256MB"
    "-sINVOKE_RUN=0"
    "-sEXIT_RUNTIME=0"
    "-sMODULARIZE=1"
    "-sSTACK_OVERFLOW_CHECK=0"
)

set_target_properties(vora_wasm PROPERTIES
    SUFFIX ".js"
)

# ============================================================================
# Install — copy WASM + JS + HTML to dist/
# ============================================================================
install(DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/www/"
    DESTINATION "${CMAKE_INSTALL_PREFIX}/www"
    OPTIONAL
)

install(TARGETS vora_wasm
    DESTINATION "${CMAKE_INSTALL_PREFIX}"
)
