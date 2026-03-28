# VSCodium Rust Rewrite

A groundbreaking, high-performance implementation of the VS Code architecture, rewritten from the ground up using **Rust**, **Tauri**, and **TypeScript**. 

VSCodium-Rust is not just "another mobile IDE." It is a **full-scale, ultra-lightweight development environment** designed for everything: **Web Applications, CMS, Backend Services, Mobile Apps, and Cloud Infrastructure.** It provides the familiar "VS Code feel" with significantly faster speeds and a fraction of the memory footprint.

## Why was this created?

Electronic-based editors have revolutionized development but often come at the cost of high memory usage and performance overhead. VSCodium-Rust sheds the weight of Electron and the handcuffs of corporate control, providing a **native-grade experience** for the modern developer.

### Absolute AI & Data Sovereignty: "Self-Hosted First"

A primary motivator for VSCodium-Rust is to provide an escape hatch from the ecosystem of **"Greedy Corporations."** Traditional IDEs often lock you into their own AI models and proprietary token usage.

We believe that **the choice of freedom is yours**:
- **Host Your Own Brain**: Connect to your own **Local LLMs** (via Ollama or custom servers) for 100% private, offline AI assistance.
- **Data Sovereignty**: Your code, your prompts, and your tokens never pass through a corporate filter. 
- **Pay Only for What You Use**: Instead of marked-up subscriptions, buy your own API keys (OpenAI, Anthropic, etc.) and integrate them at cost.

## Premium Visual Git Graph Viewer

Manage your repository with style. VSCodium-Rust includes a state-of-the-art **Visual Git Graph Viewer** with three premium layouts:
- **Classic**: The familiar, robust branching view.
- **Modern**: A sleek, high-contrast visualization for complex merges.
- **Bento**: A beautiful, modular grid-style layout for a multi-dimensional view of your history.

## For Cybersecurity Researchers

VSCodium-Rust is built by a researcher, for researchers. It is the ultimate tool for **Security Audits, Malware Analysis, and Vulnerability Research**.

- **Built-in Reverse Engineering**: Native support for the **Model Context Protocol (MCP)** and `ida-pro-mcp` means your AI agent can assist with binary analysis and decompilation directly in the IDE.
- **Isolated Terminal & Network Control**: Fine-grained control over terminal environments and process spawning.
- **Integrated Vision**: High-speed rendering for complex data visualizations.

![Researcher View 1](pics/1.png)
![Researcher View 2](pics/2.png)
![Researcher View 3](pics/3.png)
![Researcher View 4](pics/4.png)

## Architecture

- **Frontend**: A custom **TypeScript/Vite** application designed to achieve 100% visual parity with authentic VS Code. It leverages direct DOM manipulation and **GPUI primitives** for maximum layout performance.
- **Backend**: **Rust (Tauri)**, handling fast IPC, file I/O, process spawning, and host-side integration for mobile emulators.
- **The Hybrid Advantage**: We use Rust for heavy lifting (terminal emulation, AI engine, iOS emulators) and Tauri/TS for the visual authenticity of the VS Code ecosystem.

## Key Features

### 1. Authentic VS Code Parity
- **Pixel-Perfect UI**: Mimics VS Code's layout metrics, including explorer rendering and activity bar spacing.
- **Monaco Editor Backbone**: Powered by the same underlying engine as VS Code for rich syntax highlighting and LSP support.
- **Starts Instantly**: Verified < 100MB RAM usage vs 500MB+ in Electron.

### 2. Premium Antigravity Agent Built-in
Standalone, autonomous AI that lives in your sidebar. **"Just use Antigravity."**
- **Autonomous Operations**: The agent can perform complex, multi-step tasks across the entire project.
- **Mode Switching**: Toggle between `Thinking` and `Execution` modes for precise control.

### 3. All-in-One Mobile Powerhouse
The only IDE that integrates professional-grade emulators directly into the workspace panels. 
- **iOS 26.3.1 Breakthrough**: Support for the latest **Virtual iPhone Emulator** running iOS 26.3.1.
- **Zero Configuration**: Android and iOS simulators ready out of the box.

## Credits

This project stands on the shoulders of giants:
- **[Zed Industries](https://zed.dev/)**: For the groundbreaking **GPUI** primitives.
- **[The VSCodium Team](https://vscodium.com/)**: For the telemetry-free VS Code foundation.
- **Palinuro**: For pioneering privacy-first open source work.

## Support & Donations

VSCodium-Rust is an ambitious, self-funded project. If you like this project and want to support its continued development, consider buying me a coffee.

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/H4D3ZS)

## License

MIT
MIT
