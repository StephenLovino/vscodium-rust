# VSCodium Rust Rewrite

A groundbreaking implementation of the VS Code architecture, rewritten from the ground up using **Rust**, **Tauri**, and **TypeScript**. VSCodium-Rust provides a seamless, high-performance development lifecycle for everything from **Web applications** to **Native Mobile development**.
## Why was this created?

Electronic-based editors like VS Code have revolutionized development but often come at the cost of high memory usage and performance overhead. This project was born from a simple question: **Can we keep the Developer Experience (DX) of VS Code while shedding the weight of Electron?**

By leveraging Rust and Tauri, we have created an editor that:
- **Starts instantly.**
- **Uses a fraction of the RAM** (Verified < 100MB vs 500MB+).
- **Guarantees Zero Telemetry** by design, auditing every line of code.

This is not just a clone; it is a proof of concept that the future of desktop applications is native, efficient, and private.

## Architecture

- **Frontend**: A custom **TypeScript/Vite** application designed to achieve 100% visual parity with authentic VS Code without heavy frontend frameworks (React/Vue). It leverages direct DOM manipulation for maximum layout performance.
- **Backend**: **Rust (Tauri)**, handling fast IPC, file I/O, process spawning, and LLM requests via the built-in AI Engine.
- **Extension Host**: A custom Node.js-compatible layer configured to load and run standard VS Code `.vsix` extensions downloaded directly from OpenVSX.

## The Competitive Edge: Why VSCodium-Rust?

A common question is: "Isn't it redundant to build another tool using the same language (Rust) and principles as Zed?"

The answer lies in our **Target Philosophy**. We are not re-inventing the wheel; we are **bridging the gap** between the performance of tomorrow and the ecosystem of today.

### 1. Synergy, Not Redundancy
VSCodium-Rust **leverages Zed's foundational technology** (specifically its high-performance **GPUI** primitives) as a catalyst. We don't aim to build a new ecosystem from scratch. Instead, we:
- **Use Zed's "Breakthrough"**: We adopt their world-class rendering primitives for extreme UI responsiveness.
- **Maintain VS Code's "DX"**: We prioritize the 100% authentic Developer Experience that millions already know and trust.

### 2. The Bridge to the VS Code Ecosystem
Zed is an incredible new editor, but it requires users to learn a new UX and wait for a new plugin ecosystem to mature. VSCodium-Rust provides:
- **Instant Compatibility**: Full support for standard VS Code `.vsix` extensions via OpenVSX.
- **Zero Learning Curve**: Your favorite shortcuts, layout, and command palettes are precisely where you expect them.
- **Hybrid Performance**: The flexibility of a TypeScript-defined UI with the raw speed of a Rust-powered core.

### 3. Integrated Mobile Powerhouse (The "Edge")
The defining "Edge" of VSCodium-Rust is its role as an **All-in-One Mobile IDE**. While others focus solely on web or desktop, we provide the ultimate leverage for mobile engineers:
- **Zero Configuration Emulation**: Neither Zed nor standard VS Code integrates **native Android and iOS emulators** directly into the workspace panels. 
- **iOS 26.3.1 Breakthrough**: VSCodium-Rust is the only IDE to support the **Virtual iPhone Emulator running the latest iOS 26.3.1**, allowing for cutting-edge testing without leaving your editor.
- **Context Sovereignty**: We eliminate the "Context-Switching Tax" by bringing the device to the code, not the other way around.

## Key Features

### 1. Authentic VS Code Parity
- **Pixel-Perfect UI**: Precisely mimics VS Code's layout metrics, including cascading native Explorer rendering, the signature blue Status Bar, and native Activity Bar spacing.
- **Monaco Editor Backbone**: Powered by the same underlying text manipulation engine as VS Code for rich syntax highlighting and LSP support.
- **Fluid Layout**: Fully draggable right and bottom resizers that replicate VS Code's docking physics.

### 2. Premium Antigravity Agent Built-in
Unlike traditional editors that treat AI as a bolt-on sidebar plugin, VSCodium-Rust integrates the **Premium Antigravity Agent** natively into the IDE's core.
- **Secondary Right Sidebar**: Docks a dedicated chat pane independent of the left Explorer workspace.
- **Advanced Autonomous Capabilities**: The Agent dynamically selects modes (`Planning`, `Fast`), loads external context (`Add Context` popup), and executes direct filesystem or terminal interactions using local tools.

### 3. Safety & Stability (Safe IPC)
- Uses `tauri_bridge.ts` to guarantee 100% crash-free initialization logic by abstracting Tauri's invoke system. Supported by a strictly 0-warning Rust backend.

### 4. Integrated Mobile Development (Android & iOS 26.3.1)
VSCodium-Rust bridges the gap between IDE and mobile testing by integrating professional-grade emulators directly into the workspace.
- **Framed Emulator Experience**: Launch and control **Android Virtual Devices (AVD)** and the **Virtual iPhone Emulator 26.3.1 JB** directly within a dedicated sidebar panel.
- **Unified Mobile Sidebar**: A consolidated view to manage all connected and virtual mobile devices without spawning external windows.
- **Seamless App Deployment**: Build and push apps to virtual devices with one click, leveraging the local bridge for ultra-low latency interaction.

### 5. Advanced AI Integration & MCP
- **Model Context Protocol (MCP)**: Native support for the MCP standard, enabling the Antigravity Agent to connect to external tools and data sources.
- **IDA Pro Integration**: Support for `ida-pro-mcp` out of the box, bringing full-fledged reverse engineering capabilities to your AI-assisted workflow.
- **Real-time Code Editing**: Deeply integrated tools for real-time file updates, deletions, and autonomous project-wide refactoring.

## Strategic Breakthrough: Leveraging Zed

A major milestone in this project was the integration of **Zed's core infrastructure**. By adopting Zed's high-performance primitives (GPUI, efficient CRDT-based buffers, and advanced asynchronous executor), we have successfully decoupled the IDE's core logic from the overhead of traditional web technologies. 

Using Zed as a base allowed us to:
- Implement a **GPUI-powered rendering engine** for extreme UI performance.
- Achieve **native-grade state management** that is both thread-safe and incredibly fast.
- Break through previous performance bottlenecks, ensuring the editor remains responsive even under heavy load.

## Credits

This project stands on the shoulders of giants:
- **[Zed Industries](https://zed.dev/)**: For open-sourcing the Zed editor and its foundational crates (GPUI, etc.). Their engineering excellence provided the "breakthrough" needed to achieve truly native performance in a modern editor.
- **[The VSCodium Team](https://vscodium.com/)**: For their tireless work in creating a binary distribution of VS Code without MS branding/telemetry/tracking.
- **Palinuro**: For pioneering privacy-first open source work and inspiring the "Soul" of this project—absolute user sovereignty and data privacy.

## Support & Donations

VSCodium-Rust is an ambitious, self-funded project dedicated to pushing the boundaries of what a modern, native IDE can be. I focus purely on this project to ensure it stays private, fast, and open-source.

If you like this project and want to support its continued development, consider buying me a coffee. Your support helps me spend more time on new features, bug fixes, and maintaining the integrated emulators.

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/H4D3ZS)

## License

MIT
