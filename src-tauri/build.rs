fn main() {
    if cfg!(target_os = "macos") {
        println!("cargo:rustc-link-arg=-Wl,-ld_classic");
    }
    tauri_build::build()
}
