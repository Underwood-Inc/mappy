offline- first portable Crimson Desert interactive map and a sandbox map tool

<img width="3839" height="2159" alt="image" src="https://github.com/user-attachments/assets/865e0e78-2a6a-4dd1-aba5-2abea76daae7" />

<img width="3830" height="2159" alt="image" src="https://github.com/user-attachments/assets/a281226f-1f63-4210-ad0c-c95d4b670296" />

<img width="3839" height="2159" alt="image" src="https://github.com/user-attachments/assets/492d64bc-ebcd-4ca6-b9ad-438279e4171a" />

## How you get mappy

**Released builds (what we distribute):**  
We publish a **Windows installer** built as an **NSIS setup**—this is the build we point players and collaborators at from the project’s **Releases** page.

**What that means for you:** download and run the installer on Windows; you get a **native desktop app** with the map shell and offline-oriented behaviour described elsewhere in this document.

**Not in the default release channel:** we do **not** currently distribute macOS/Linux desktop installers or Play Store-style packages as part of this project’s standard releases.
---

## For contributors (development workflow)

**Day-to-day development** on this repository typically uses a **different desktop shell** than the one we ship: the team runs and debugs with an **Electron-based dev workflow** (live-reload against the same UI you see in the shipped app), then **packages the production Windows build** through the **Tauri + NSIS** pipeline that produces the installer on Releases.

You do **not** need to install Electron’s packaged output to play the released game—use the **NSIS installer** from Releases for that.

---

Latest **Releases** (short link): https://s.idling.app/mappy
