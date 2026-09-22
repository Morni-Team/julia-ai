<div align="center">

<img src="docs/assets/banner.en.svg" alt="Julia – your AI for the Windows PC" width="100%">

<p>
  <a href="https://github.com/MoinMornhart/julia-ai/releases/latest"><img alt="Version" src="https://img.shields.io/github/v/release/MoinMornhart/julia-ai?label=version&color=ff7a1a&style=flat-square"></a>
  <a href="https://github.com/MoinMornhart/julia-ai/commits/main"><img alt="Last commit" src="https://img.shields.io/github/last-commit/MoinMornhart/julia-ai?label=last%20commit&color=ec4899&style=flat-square"></a>
  <img alt="Windows 10 | 11" src="https://img.shields.io/badge/Windows-10%20%7C%2011-0078d4?logo=windows&logoColor=white&style=flat-square">
  <img alt="Electron" src="https://img.shields.io/badge/Electron-2c2e3b?logo=electron&logoColor=9feaf9&style=flat-square">
  <img alt="Local: Whisper and Piper" src="https://img.shields.io/badge/local-Whisper%20%C2%B7%20Piper-2ea44f?style=flat-square">
  <a href="LICENSE"><img alt="License MIT" src="https://img.shields.io/github/license/MoinMornhart/julia-ai?label=license&color=22d3ee&style=flat-square"></a>
</p>

<p><a href="README.md">🇩🇪 Deutsch</a> · <b>🇬🇧 English</b></p>

**Sees your screen, talks with you, plays Minecraft with you – and asks first before anything that can’t be undone.**

🌐 **[Website](https://moinmornhart.github.io/julia-ai/)** · ⬇ **[Julia-AI-Setup.exe](https://github.com/MoinMornhart/julia-ai/releases/latest/download/Julia-AI-Setup.exe)** · 📦 **[Install – step by step](docs/installation.en.md)**

[What Julia is](#what-julia-is) · [Small helpers](#small-helpers) · [Your apps](#works-with-your-apps) · [Minecraft](#minecraft) · [On your phone](#julia-on-your-phone) · [Installation](#installation)

<br>

<img src="docs/bilder/start-en.png" width="860" alt="Main window with the home page: greeting, appointments, inbox, reminders, PC status and costs">

</div>

## At a glance

<table>
  <tr>
    <td width="33%" valign="top">
      <img src="docs/bilder/chat-en.png" alt="Chat with an approval card"><br>
      <b>Asks first</b><br>
      <sub>Every action goes through the traffic light: green just happens, yellow needs your yes, red never.</sub>
    </td>
    <td width="33%" valign="top">
      <img src="docs/bilder/sprache-en.png" alt="Settings: speech recognition with Whisper and a natural voice"><br>
      <b>Listens and speaks</b><br>
      <sub>Whisper understands you, a natural voice answers – both run on your PC.</sub>
    </td>
    <td width="33%" valign="top">
      <img src="docs/bilder/overlay-en.png" alt="Gaming overlay on top of a game"><br>
      <b>In your game</b><br>
      <sub>An overlay on top of your game – clicks pass through, customizable down to the details.</sub>
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      <img src="docs/bilder/minecraft-en.png" alt="Minecraft tab in the middle of a game"><br>
      <b>Plays Minecraft with you</b><br>
      <sub>As a character of its own: follows, protects, mines, hunts, crafts and brings you items.</sub>
    </td>
    <td width="33%" valign="top">
      <img src="docs/bilder/mcp-en.png" alt="Settings: connected MCP servers"><br>
      <b>Extensible with MCP</b><br>
      <sub>GitHub, Notion, databases, folders – MCP servers bring new tools.</sub>
    </td>
    <td width="33%" valign="top">
      <img src="docs/bilder/overlay-einstellungen-en.png" alt="Tool settings"><br>
      <b>Controls the PC</b><br>
      <sub>Media and volume, window snapping, timer and stopwatch, calculate and convert.</sub>
    </td>
  </tr>
</table>

## What's new

- **Knowledge graph – Julia remembers connections** – alongside the free-form memory, Julia now has a **knowledge graph**: small "building blocks" (people, projects, apps, places …) with notes, plus **links** between them (e.g. "Morni – works on → Julia"). This lets her look up and extend relationships on purpose instead of hunting through one long text. Runs entirely locally (its own file), credentials are never stored; the overview is available to the AI in context, details are fetched with the new graph tools (in the switchable "Memory" category).
- **Mic now tells you when it caught nothing** – when Julia listened but recognized nothing, it used to just silently go back (felt like "the mic doesn't work"). Now it shows a clear hint ("didn't catch anything – test the mic / raise the speech pause"). Also fixed: if the accurate (Whisper) recognition returned an empty result, Julia now falls back to Windows recognition instead of discarding the sentence entirely.
- **Mic no longer stays stuck** – if speech recognition ever hangs (instead of ending cleanly), Julia frees the mic again on its own after a short while instead of staying "dead". It also now writes detailed diagnostics to the startup log while listening, so mic problems can be pinpointed.
- **Mic no longer cuts you off mid-sentence** – on a short thinking pause, speech recognition used to end the recording after just 1 second (felt like a "random abort"). Julia now waits longer (default 1.6 s), and you can set the **speech pause** yourself in the voice settings (0.5–5 s) – turn it up if the mic still cuts you off.
- **Minecraft: survives longer (eats in time)** – Julia now eats earlier and keeps her hunger high so her health regenerates on its own – so she goes down far less often while mining and exploring (and uses the golden apple earlier). She also searches a larger radius for animals when hunting, so she runs out of food less quickly.
- **Minecraft: individual players & chat toggle** – in the Minecraft tab you can now add individual **players** that Julia also listens to (with "Add" and ✕ to remove) – effective immediately in-game. And the **chat messages** in the tab can be hidden with a toggle.
- **Minecraft: swimming & less getting stuck** – Julia now surfaces on her own when she runs low on air in water, so she no longer drowns. And when she gets stuck on an obstacle while walking (e.g. a tree trunk), she recalculates the path and goes around instead of jumping against it forever.
- **Minecraft: thriftier with crafting table & furnace** – Julia no longer builds a new crafting table or furnace every time. If she already has one or one is nearby, she uses it – saving wood and stone.
- **Minecraft: water MLG & nicer inventory** – Julia now saves herself from deep falls with the **water bucket** (places water just before impact and picks it back up) – needs a water bucket in the inventory. Also, the **inventory** is its own clear area in the Minecraft tab (items as chips with counts) instead of being squeezed into one line.
- **Minecraft: crafting no longer gets stuck** – on laggy/finicky servers, crafting often failed with a 20-second timeout even though the item was actually made – Julia then retried in vain. Now she checks the inventory after each craft to see whether it worked, and moves on instead of getting stuck.
- **Minecraft: bucket & "Leave"** – Julia can now handle the **bucket**: pick up water/lava, place water/lava (e.g. for a safe descent or to douse fire) and drink milk (clears effects). Also: when you press **"Leave"**, she now stays away for good – she only comes back on her own after a real crash/kick.
- **Minecraft: inventory visible** – the Minecraft tab now shows what Julia is carrying (e.g. "39× cobblestone, 8× coal, 8× torch"), alongside health, hunger, location and task.
- **Minecraft: better mob defense** – Julia now reacts **earlier** to enemies (ranged ones like skeletons/witches from farther away, creepers early) and, in a group, goes for the **most dangerous** mob first instead of being overrun by the nearest one. So she dies less at night.
- **Cut tab opens now** – the tab (now "Cut" instead of "Video") was empty when clicked because it wasn't registered internally. Fixed – it opens normally.
- **Video cutting actually works now** – the Video tab was there, but cutting was missing **ffmpeg** (the program that does the work). Julia now **downloads it once** at the press of a button (~79 MB, with progress and checksum) and stores it locally – after that, cutting and thumbnails work entirely offline, without you installing anything. (You can still point to a self-installed ffmpeg in the settings.)
- **Mic hotkey & "Hey Julia" work reliably again** – sometimes neither the mic hotkey nor the "Hey Julia" wake word responded, seemingly at random. The cause was a stuck internal counter after an interrupted read-aloud that made Julia think she was permanently "speaking". Fixed – muting now resets that state cleanly.
- **Google/Outlook sign-in: clearer help** – the Google "access blocked / 403" error now explains that your account must be added as a **test user** (or the app published), instead of just saying "declined".
- **Dedicated Video tab for cutting** – cutting videos and making thumbnails now has its own area (the "Video" nav item), not just via chat: pick a file, enter from–to, **Cut** – or grab a **thumbnail** at a given time. Runs entirely locally via ffmpeg, nothing is uploaded; the result is saved next to the source file and can be shown in the folder directly. (Needs ffmpeg on the PC; if it's missing, the tab says so clearly.)
- **Minecraft no longer clutters the overlay & bubble** – Julia's Minecraft replies and actions no longer show up in the gaming overlay and the floating bubble; they stay in the window (chat/Minecraft tab). Important approvals (traffic light) are still shown.
- **Automatic updates work again** – after the project moved to its new home (`Morni-Team/julia-ai`), the app was still looking for updates at the old location. Everything now points to the right address. (Please install this one version by hand once, after that it's automatic again.)
- **Minecraft comes back on its own after a kick** – if the character is kicked from the server (e.g. a periodic timeout/anti-bot kick), it now reconnects automatically. Only when it's pointless (ban, whitelist, wrong version, "flying" anti-cheat) does it stay away – with a clear message.
- **Outlook sign-in: clear help instead of a cryptic error** – if a Microsoft-owned application ID (e.g. the Azure Portal's) is entered by mistake, Julia now says so directly. And the common "AADSTS90072" error is explained clearly (you need your own app registration that also allows personal Microsoft accounts).
- **No more constant notifications while building in Minecraft** – Julia used to send a Windows notification for **every** Minecraft event (including building/eating). Now it reports only **important** things by default (e.g. disconnected, died, danger, goal reached). You can change this in the Minecraft area: "Important only" (default), "All" or "None". The Minecraft area still shows everything live.
- **Duplicate MCP servers cleaned up** – if a server (e.g. VibeWorks) appeared twice in the MCP settings, it's now automatically de-duplicated (by address/command) – when adding/importing and once at startup. The display glitch where the overlay literally showed `{name}` instead of the name is fixed too.
- **Empty window & false "interface is empty" alarm really fixed** – the actual cause has been found: in the packaged program the bundled texts didn't reach where the interface needs them to label itself (a technical sandbox reason). So the labels stayed empty and Julia falsely assumed the window was "broken" and kept restarting – even though it actually worked. Julia now gets the texts over a reliable path and fills the interface itself if needed; and a "labels empty" suspicion never again triggers a restart or the "interface stays empty" error. This was the stubborn bug that made the app unusable on some PCs.
- **Runs on (almost) any device now – crash protection (XXL update)** – two big robustness improvements so Julia starts safely even on weaker/finicky PCs and no longer vanishes silently: (1) A **global safety net** now catches unexpected errors – **at startup** you get a clear message instead of a silent crash, and **during use** Julia simply keeps running on a background error instead of crashing entirely. (2) If Julia's **data folder is locked** (permissions, antivirus, etc.) – a common reason the app won't even open – it automatically falls back to a replacement folder instead of failing to start. Everything still stays local in the startup log (nothing is sent).
- **Thoughts box shows up instantly – and thinking effort is now adjustable** – the "Thoughts" box now appears **immediately** when the answer starts (expanded, so you can see right away that Julia is working) and fills in live; if no reasoning step arrives, it disappears again. New: you can now set the **thinking effort** (e.g. to "medium") for OpenAI-compatible providers too – it's sent as `reasoning_effort`. If a model doesn't know the setting, Julia automatically drops it for that model (no error). How much "thinking" becomes visible still depends on the model/provider.
- **One single memory system (fewer tools)** – "memory" and "learning notes" used to be two separate tool groups (6 tools). Julia now uses **one** group (remember/read/delete): the global memory by default, and with a "project" switch the project-scoped notes in the work folder (which travel with the project). Fewer tools = faster and more token-efficient – and nothing is lost, both stores stay.
- **Auto-update works reliably again** – for some, the automatic update broke off mid-way ("processes still active") because the installer accidentally killed itself during the hard shutdown. Fixed: Julia now only closes its own programs (not the running installer). Note: this improvement takes effect from the next installer – if your update is stuck, install the current version once by hand from the Releases page, after that it's automatic again.
- **Reasoning step now visible with more providers** – the collapsible "reasoning" box now also appears for OpenAI-compatible providers that send their reasoning step (e.g. DeepSeek), not just Anthropic.

All changes are in the [CHANGELOG](CHANGELOG.md). There's a little easter egg too – type (or say) `jarvis`. In Jarvis mode just “Jarvis” works as the wake word and the voice changes; “julia” switches back. 😉

## Contents

[What Julia is](#what-julia-is) · [Home, history, routines](#home-and-history) · [Voice and speech](#voice-and-speech) · [Small helpers](#small-helpers) · [AI providers](#ai-providers) · [The traffic light](#the-traffic-light) · [MCP servers](#mcp-servers) · [Gaming overlay](#gaming-overlay) · [The orb](#the-orb) · [Minecraft](#minecraft) · [Julia on your phone](#julia-on-your-phone) · [Accounts, several PCs](#connecting-accounts) · [Design](#design) · [Installation](#installation) · [Usage](#usage) · [Updates](#updates) · [For developers](#for-developers) · [Limits](#limits) · [License](#license)

## What Julia is

Julia is not a general chatbot but a program that keeps running on your computer and waits
for instructions. You write to her in the chat, press a hotkey or say “Hey Julia”. She looks
at what is going on and gets it done – from renaming 200 files to debugging a repo.

- **Sees the screen** – screenshots of all monitors, window list, processes, system status.
- **Acts** – clicks, types, presses keys, opens programs, writes and moves files, runs PowerShell.
- **Reads and reviews code** – read first, then judge; suggestions as a diff, tests before and after.
- **Installs cleanly** – checks first whether it is already there, then `winget` or the vendor’s site, then a version check.
- **Researches** – web search and page fetching for anything that needs to be current.
- **Remembers lasting things** – projects, ways of working, devices. Never credentials.
- **Reminds you** – “Remind me about the call at 3 pm”, “pizza out in 20 minutes”. As a notification, in the chat and read aloud if you like.
- **Speaks** German or English – with Whisper as her ears and a natural voice, both local. More under [Voice and speech](#voice-and-speech).
- **Updates herself** – only to published versions, with a verified checksum.

## Home and history

The main window has a sidebar on the left: **Home** shows your day at a glance – appointments,
unread mails (sender and subject only), reminders, PC status and costs – plus a **daily
briefing** at the push of a button. **Chat** is the conversation. In **History** you find,
search and continue earlier conversations with one click.

<p align="center">
  <img src="docs/bilder/verlauf-en.png" width="760" alt="History with search and preview">
</p>

Conversations are stored encrypted with Windows, only on your PC; screenshots are never saved.

**Routines** are your own sequences at the push of a button – like “Done for today”, “Focus” or
“Gaming” with up to twelve steps in your words. Julia presents the whole sequence once for
approval; it only applies to that run, RED stays RED.

<p align="center">
  <img src="docs/bilder/routinen-en.png" width="760" alt="Routines: done for today, focus, gaming">
</p>

**Files and selected text:** Drag files into the chat or attach them with the paper clip –
texts, images and (with Claude) PDFs. Images are downscaled and re-encoded, dropping metadata
such as GPS coordinates. In any program, select text and press `Ctrl+Alt+T` for translate,
summarize, rephrase, explain, fix mistakes, draft a reply or your own question. Attached files
and selected text count as outside content – what they say is never an instruction.

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/bilder/clips-en.png" alt="Clips view with thumbnails"><br>
      <b>Clips</b> – <code>Ctrl+Alt+C</code>, the button or “Clip that!” saves the last seconds of your game. Julia triggers your system’s recording (Xbox Game Bar, NVIDIA or AMD) and finds the file afterwards. Play, rename, show in folder or move to the recycle bin.
    </td>
    <td width="50%" valign="top">
      <img src="docs/bilder/code-en.png" alt="Code tab with changes and commits"><br>
      <b>Code</b> – your projects with branch, changed files (click shows the diff), commits and scripts. Buttons give Julia a task: <i>explain project</i>, <i>review changes</i>, <i>run tests</i>, <i>fix errors</i>, <i>suggest a commit message</i>. Nothing is written without your yes.
    </td>
  </tr>
</table>

## Voice and speech

<p align="center">
  <img src="docs/bilder/sprache-en.png" width="620" alt="Settings: microphone, Whisper speech recognition, natural voice and microphone test">
</p>

- **Listening with Whisper:** Windows notices when you start and stop talking; transcription is done by [whisper.cpp](https://github.com/ggml-org/whisper.cpp) – accurate, locally on your PC. Julia downloads the model once (*Accurate*, 190 MB, or *Fast*, 60 MB) and only uses it if its SHA-256 checksum matches. She only computes as much audio window as you actually spoke – that makes it several times faster.
- **Natural voices:** At the top of the voice list are the neural voices **Thorsten** and **Kerstin** ([Piper](https://github.com/rhasspy/piper), freely licensed, German). Pick one and Julia downloads it once – until then the Windows voice speaks. Julia sounds like that in the Minecraft voice chat too.
- **Fast answers:** Julia doesn’t wait for the whole answer but speaks sentence by sentence as it arrives. By voice she thinks at most medium-deep – the first word comes sooner.
- **“Hey Julia”:** If you like, Julia reacts to her wake word – with her name, so “Hey Rainer” works too – or to your own words like “Computer, listen”. Off by default because the microphone stays open for it; only the word is recognized, nothing is recorded.
- **Microphone test:** *Settings → Speech → Test microphone* records a sentence, shows the level and what was understood, checks the Windows privacy blocks and names the cause if something is off – with a report to copy.
- You pick microphone and speakers freely; the orb moves with the real loudness of the voice.
- **Live subtitles:** While you speak, the orb shows what Julia understands word by word (like Siri); at the end of the sentence the accurate Whisper version replaces the text.

## Small helpers

Besides the big tasks, Julia handles the small moves on the PC too – all local:

- **Media & programs:** play/pause, next/previous track, volume up/down/mute via the system keys (for any player); launch programs by name and – after asking – close them.
- **Snap windows:** dock left/right or top/bottom, into the four corners, center, maximize or restore.
- **Timer, alarm & stopwatch:** “set a timer for 10 minutes”, an alarm at a time, plus a stopwatch with laps.
- **Calculate & convert:** calculate, convert units (length, mass, time, data, temperature …), transform text (upper/lower, Base64, JSON, count) and make QR codes.

## Works with your apps

Julia works together with **your own apps**. For each app you enter its **domain (address)** and
your **login or an API key** once under *Settings → Apps* – then Julia performs the actions
directly through your app's API:

| App | What Julia can do | Connect |
|---|---|---|
| **ToDoch** – your tasks app | “Put milk on my ToDoch list”, “Remind me tomorrow at 9 about the dentist” – Julia creates the task. | Domain + API key |
| **Streamo** – your movies/shows app | “Add Iron Man to my Streamo list” – Julia adds the title to your list; searching too. | Domain + API key |
| **VibeWork** – your projects app | “Create a VibeWork project Website”, “Invite Anna to project Website”, “Get the latest commit of Website”. | Domain + API key |
| **Patchfeld** – your learning app (IHK) | “Start my Patchfeld session”, “What's my progress?” | Domain + API key |
| **Codewerk** – your learning app (code) | “Start a Codewerk session in Python”, check progress. | Domain + API key |
| **Content-Helper** – your creator app | “Plan a post for Friday”, “Give me ideas about topic X”. | Domain + API key |

Sending data to an app (create a task, add to a list, create a project, invite) is a **YELLOW**
step of the traffic light – Julia asks first. Domain and key, like all accounts, are stored
encrypted on your PC only and never appear in the conversation. The expected API endpoints per app
are documented as a contract at the top of [`src/main/apps.js`](src/main/apps.js).

## AI providers

Julia runs with the provider of your choice – *Settings → General → AI provider*:

| Provider | What you need |
|---|---|
| **Anthropic (Claude)** – default | API key from [console.anthropic.com](https://console.anthropic.com). The only provider with built-in web search. |
| **OpenAI**, **Google Gemini**, **Mistral**, **Groq**, **OpenRouter** | the provider’s API key |
| **Ollama**, **LM Studio** | nothing – the model runs for free on your PC |
| **Custom address** | any OpenAI-compatible endpoint (HTTPS, or HTTP on your home network) |

Every key is stored encrypted with Windows. *Load models* fetches the current model list from
the provider. The model must be able to call tools, and for screenshots it must understand
images. Traffic light, approvals and the cost brake work the same with every provider.

## The traffic light

Every action falls into exactly one level. It isn’t just in the prompt – the software checks
it itself before anything runs.

| Level | What happens | Examples |
|---|---|---|
| 🟢 **GREEN** | Julia just does it. | Reading, screenshots, opening programs, files in your working folders, read-only shell commands, tests |
| 🟡 **YELLOW** | Julia says in one sentence what will happen and waits for your yes. | Installing software, files outside the working folders, registry, services, `git push`, admin rights, tools from MCP servers |
| 🔴 **RED** | Never, not even on explicit instruction. | Typing passwords or card data, logins, payments, `rm -rf`, emptying the recycle bin, disabling antivirus, running code from the web |

<details>
<summary><b>What the software enforces itself</b></summary>

- Shell commands are classified. Only clearly read-only commands are GREEN, anything unclear is YELLOW, permanent deletion and disabling protection are blocked.
- `type` checks via UI Automation whether the focus is in a password field and refuses terminals as well as card and IBAN numbers.
- `click`, `type` and `key` only work with a fresh screenshot (“never click blind”) and deliver a new one afterwards.
- Password fields in the foreground window are blacked out in the screenshot before the image leaves the PC – as far as the program reports them as password fields.
- While Julia looks at your screen or controls mouse and keyboard, a notice with a stop button sits at the top center. It doesn’t appear in Julia’s own screenshots.
- Julia’s own files (configuration, API keys, memory) are never writable without asking.
- Every YELLOW action is logged, overwritten files are backed up first. The log is a checksum chain: if something is changed or deleted in the middle, Julia reports it at startup.
- **Cost brake:** Julia tracks API costs and stops once the daily limit is reached (default US$10) – even in the middle of a task.
- **Data exfiltration protection:** Once outside content is in the conversation (mails, files, websites, screen, MCP servers), Julia also asks before links and network commands. She strips invisible characters used to hide commands in text, and may only remember things permanently with your yes.
- Julia never starts programs downloaded from the internet (Mark of the Web).
- An approval covers exactly one action. In **hands-on** mode (“push it through”) Julia presents the whole task once; afterwards only the named categories run without asking.
- **“Approve everything”** is under *Settings → Approvals* – only by hand and after a confirmation; Julia can’t switch it on herself. Red stays blocked, and after outside content Julia still asks before anything goes out – unless you explicitly switch that off too.

What the software **can’t** detect: that a particular click sends a mail or places an order.
That is Julia’s own job – she asks in the chat.
</details>

## MCP servers

<p align="center">
  <img src="docs/bilder/mcp-en.png" width="620" alt="Settings: two connected MCP servers with status and tools">
</p>

With the [Model Context Protocol](https://modelcontextprotocol.io) you connect Julia to any MCP
server – for example for GitHub, Notion, a database or specific folders. Their tools join
Julia’s own. *Settings → Connections → MCP servers → Add server*:

| Type | Example |
|---|---|
| **Program on this PC** (stdio) | `npx -y @modelcontextprotocol/server-filesystem C:\Users\you\Documents` |
| **Address** (Streamable HTTP) | `https://mcp.example.com/mcp` – unencrypted only on this PC (`localhost`) |

- **Asks first:** Every call to an MCP tool is YELLOW. Only if you mark a server as *trusted* do its read-only tools run without asking.
- **Outside content:** Whatever a server returns, Julia treats like a website – never as an instruction, and data exfiltration protection applies.
- **Tokens encrypted:** Environment variables (say, a GitHub token) and HTTP headers are stored encrypted in the vault, never in `config.json`, and are never shown.
- For each server you see its state and tools and can switch it off and on, restart or remove it.

> An MCP server is a program with its own rights. Only add servers you trust.

## Gaming overlay

<table>
  <tr>
    <td width="36%" valign="top"><img src="docs/bilder/overlay-en.png" alt="Overlay on top of the game"></td>
    <td width="64%" valign="top"><img src="docs/bilder/overlay-einstellungen-en.png" alt="Overlay settings: size, font, background, compact mode, preview"></td>
  </tr>
</table>

`Ctrl+Shift+Space` puts a semi-transparent chat window over your game – in windowed or
borderless fullscreen mode. Type, Enter, keep playing.

- **On its own while gaming:** When you start a game, the overlay appears automatically – passive, clicks pass through, the game keeps focus. Games from Steam, Epic, Riot, Battle.net, EA, Ubisoft, GOG and Xbox plus Minecraft are recognized; add more by program name.
- **Click in, scroll, type:** Over the overlay you scroll the history, a click opens the input field, a click back into the game makes it see-through again.
- **Your way:** Width, height, font size, background opacity (the text stays sharp), compact mode with only the last three messages, how long answers stay – with a preview button.
- **Freely movable:** drag it by the header, Julia remembers the spot.
- **Always there:** If you like, the overlay stays visible all the time, even without a game.
- Approvals appear in the overlay instead of putting the big window over your game. Julia only hooks into the mouse while the pointer is over her windows – your game stays smooth.

> In *exclusive* fullscreen, Windows never shows overlays – switch the game to “borderless
> window”.

## The orb

If you like, an animated orb sits on your second monitor and shows what Julia is doing. It is
**off by default** and lets clicks pass through – only the orb itself can be grabbed and
dragged anywhere; a double-click opens the chat. Below it, subtitles show what you say and what
Julia answers.

<p align="center">
  <img src="docs/bilder/blase-idle.png" width="150" alt="idle">
  <img src="docs/bilder/blase-listening.png" width="150" alt="listening">
  <img src="docs/bilder/blase-thinking.png" width="150" alt="thinking">
  <img src="docs/bilder/blase-speaking.png" width="150" alt="speaking">
</p>
<p align="center"><sub>idle · listening · thinking · speaking</sub></p>

Monitor, corner, size, opacity, speed, sensitivity and any number of colors per state can be
changed at runtime – in the settings or simply by saying: “Make it greener.”

## Minecraft

Julia plays Minecraft (Java Edition) with you – as a character of her own on your server or in
your world. In the **Minecraft** tab you only enter the address and click **Join**. Julia finds
the server like the game itself does (including SRV records and server protection such as
NeoProtect or TCPShield).

<table>
  <tr>
    <td width="50%" valign="top"><img src="docs/bilder/minecraft-aufgaben-en.png" alt="Tasks: follow, protect, duel, collect, hunt, store, sleep, give, craft, go to"></td>
    <td width="50%" valign="top"><img src="docs/bilder/minecraft-absturz-en.png" alt="Crash screen: Julia was kicked from the server, with reason, time and a reconnect button"></td>
  </tr>
</table>

| Task | In game chat | What happens |
|---|---|---|
| Follow · Come here | `!follow` · `!come` | follows you or walks over once |
| Protect · Duel | `!protect me` · `!duel` | fights monsters near you or fights you |
| Mine | `!mine oak_log 10` | mines blocks and collects them |
| Go to | `!go 100 64 -20` | walks to coordinates |
| Give | `!give 5 bread` | brings you something from her inventory |
| Collect | `!collect` | picks up items lying around |
| Hunt | `!hunt 3 cow` | gets food from animals and collects it |
| Craft | `!craft 4 torch` | crafts in her inventory or at the nearest crafting table |
| Store | `!store` | puts her inventory into the nearest chest (weapons, tools, food stay) |
| Smelt | `!smelt 8 raw_iron` | smelts or cooks in a furnace, takes fuel on her own |
| Place · Eat | `!place crafting_table` · `!eat` | puts a block down next to her · eats something |
| Build | `!build tower 8` · `!build wall 10 3` · `!build hut` | builds a tower, wall, hut or bridge from available material |
| Boat & mount | `!board` · `!disembark` | gets into a boat, minecart or onto a mount – and out again |
| Play through | `!spiel durch` | works her own way stage by stage toward the Ender Dragon |
| Control listening | `!hör auch auf NAME` · `!hör nur auf mich` | allow individual players or reset |
| Sleep · Stop | `!sleep` · `!stop` | goes to bed · stops right away |

`!help` lists every command in the game. Fighting, following and dodging run 20 times a second
directly in Julia – the AI only sets the task. She **sees what's in front of her** (lava or a drop
too) and brakes on her own, **eats** when hungry, and **fights smart**: she equips weapon and
armor herself, retreats or reaches for a golden apple when low on health, and doesn't hug a
creeper but keeps her distance.

- **Addressing her:** it's enough if `Julia` appears anywhere in the message (not just at the start); `!` works too. By default she listens **only to you**. You can allow individual people in-game – “Julia, also listen to Peter and Anna”, “stop listening to Peter”, “listen to me only” – or switch on the coarse “listen to everyone” in the panel. She only ever acts in the game, never on the PC, and only the owner can change it.

- **Task for Julia:** In the tab you write in your own words what she should do – say, “Get wood, build a crafting table and make yourself a stone pickaxe”. She looks around, plans the steps and works through them with her abilities, waits for each result and says at the end what she achieved.
- **Playing through & learning:** With `!spiel durch` (or “play through”) she works her own way along a **tech tree** – from the first wood through stone, iron and diamond to the Nether and the Ender Dragon. Thanks to the progress view she always knows which stage she's on and what's next. A **daily logbook** records everything (one file per day in the data folder, written to disk immediately) – it survives a crash, so a play day is never lost and you can see afterwards what worked and where she got stuck. Honestly: a guaranteed solo run to the dragon isn't certain – but she understands the path, makes real progress, and gets measurably better via the logbook.
- **Voice chat groups:** Julia lists the groups from the server’s Simple Voice Chat; you choose which one she joins. For a protected group you enter the password – it only goes to the server, the AI never sees it. With “Always join” Julia joins on her own next time; the password is then stored encrypted on your PC.

<p align="center">
  <img src="docs/bilder/minecraft-gruppen-en.png" width="760" alt="Voice chat groups: Julia is in one group, an open group and one with a password">
</p>

- **Crash screen:** If Julia gets kicked, the tab shows why – in plain words, with the time, how long she played and the task that was running. After a lost connection she tries three times on her own, after a kick she doesn’t.
- **Account:** Without an account it works on servers with `online-mode=false`. With **Connect account** you sign in Julia’s own Java account – in the browser at microsoft.com/link; Julia never sees a password.
- **Talking:** In the game chat write “Julia, …” or “!…”; the answer comes back into the game chat. With “Hey Julia” you talk to her through your microphone while playing. She only accepts questions from your player name, and from there she only acts in the game – never on your PC.
- **Voice chat (preview):** If the server runs Simple Voice Chat, Julia listens there and answers by voice in the game. She only listens to your player name; other voices are dropped right away.
- **Limits:** On her own, only servers on your PC or home network; you add a server on the internet yourself. Big public networks like Hypixel are blocked – bots are banned there.

## Julia on your phone

Julia also comes as a standalone **app for Android and iOS** – the source is in the
**[julia-android/](julia-android/)** folder, built with [Expo/React Native](https://expo.dev). How to
start it is in **[julia-android/README.md](julia-android/README.md)**.

In the app you chat with Julia straight through your AI provider (**Claude** or **OpenAI**) – with
streaming, read-aloud and a cost display; the API key is kept in the phone's secure keystore.
The app **works on its own – even when your PC is off**.

Optionally the app connects to your PC on your **home network or VPN** and drives the Julia there:
on the PC under *Settings → Connections → Android app* show a code, then enter the address and code
in the app. Requests run through the PC Julia **with the traffic light**, and approvals appear on the
PC. It only talks on the home network/VPN, no port to the internet.

**Start (on your computer):**
```bash
cd julia-android
npm install
npx expo start
```
Then scan the QR in **Expo Go** (Android/iOS) or use the emulator. Building and testing happens on
your machine – Android/iOS tooling or Expo Go required.

## Connecting accounts

<p align="center">
  <img src="docs/bilder/verbindungen-en.png" width="560" alt="Connections: Google and Outlook">
</p>

Julia can use your **Google account** (Gmail, Calendar, Contacts) and your **Outlook account**
(Outlook.com, Hotmail or Microsoft 365) – even both at once:

> “Any new mail?” · “What’s on tomorrow?” · “Tell Anna I’ll be ten minutes late.” ·
> “Add the dentist on Friday at 2 pm.”

| Julia can | Traffic light |
|---|---|
| Search and read mails, save attachments, create drafts | 🟢 |
| View appointments, find contacts | 🟢 |
| Send mails, create appointments, send invitations | 🟡 – the approval card shows recipients and the full text |
| Delete mails or appointments | not available |

You sign in yourself in the browser; Julia never sees a password:
**[Guide for Google](docs/google-setup.en.md)** · **[Guide for Outlook](docs/outlook-setup.en.md)**.
Whatever a mail says is never an instruction for Julia.

### Several PCs

If you run Julia on several PCs, they sync **conversations, memory, routines and reminders**
directly with each other – on your home network or through your VPN, no cloud. *Show code* on
one PC, *Enter code* on the other – done. API keys, accounts, settings and the log stay on each
PC.

## Design

The default is **dark gaming look**: deep background with a fine grid, glowing accents,
approval cards with warning stripes, tool steps in terminal style. There is also **Light** and
**Like Windows**, seven accent colors (Ember, Neon, Cyber, Toxic, Magenta, Blood, Gold) and one
of your own from the color picker. Everything applies instantly, no restart.

**Your AI, your name:** Give her a name of your own (“Rainer” instead of “Julia”), choose her
form (assistant, female, male or neutral) and your own pronouns. The name appears everywhere.

## Installation

**Easiest:** download [Julia-AI-Setup.exe](https://github.com/MoinMornhart/julia-ai/releases/latest/download/Julia-AI-Setup.exe)
and double-click it – no admin rights, just for your user account. All versions and their
checksums (`latest.yml`) are under [Releases](https://github.com/MoinMornhart/julia-ai/releases).
The installer isn’t signed yet; if Windows says “Windows protected your PC”, click “More info” and then “Run anyway”.

On first start the setup opens: first name, AI provider with key and the folders where Julia may
write without asking. Keys are stored encrypted with Windows (DPAPI).

<details>
<summary><b>From source</b></summary>

**Requirements:** Windows 10 or 11, [Node.js](https://nodejs.org) 20 or newer and
[Git](https://git-scm.com).

```powershell
git clone https://github.com/MoinMornhart/julia-ai.git
cd julia-ai
npm install
npm start
```

Whisper ships ready in `vendor/whisper` (refresh with `node scripts/whisper-holen.js`). If
`npm start` says Electron is missing: run `node node_modules/electron/install.js`.
</details>

## Usage

| What | How |
|---|---|
| Open / close chat | `Ctrl+Alt+J` or click the tray icon |
| Speak | `Ctrl+Alt+Space` or “Hey Julia” – press again to cancel |
| Gaming overlay | `Ctrl+Shift+Space` |
| Take selected text | `Ctrl+Alt+T` |
| Save a clip | `Ctrl+Alt+C` |
| Stop the running task | stop button or `Esc` in the chat |

All hotkeys can be changed in the settings. Answers are read aloud when you spoke (adjustable:
always, never, when speaking).

## Updates

Julia checks for a new version at startup and every two hours after that – never in the middle
of a game. She downloads the installer from the releases, verifies its SHA-512 checksum and only
installs it once the running task is done. By hand: tray menu → **Check for updates**.
Installing without asking can be switched on under *Settings → System*.

Julia counts in steps of ten: `0.5.9` → `0.6.0`, `0.9.9` → `1.0.0`.

<details>
<summary><b>Where Julia keeps her data</b></summary>

Everything is in `%APPDATA%\Julia`. Updates never touch this folder.

| File / folder | Content |
|---|---|
| `config.json` | all settings, keys only encrypted |
| `konten.json` | connected accounts and the vault – tokens only encrypted |
| `gedaechtnis.json` | what Julia remembers permanently |
| `gespraeche\` | conversations, encrypted with Windows |
| `protokoll.jsonl` | every action beyond GREEN, as a checksum chain |
| `sicherungen\` | previous versions of overwritten files |
| `whisper\` · `piper\` | speech model and natural voices, downloaded once |
</details>

## For developers

<details>
<summary><b>Structure, tests, releases</b></summary>

```
prompt/            system prompt, German and English
src/main/          main process: agent, tools, traffic light, speech, Whisper, Piper, MCP, Minecraft
src/main/win/      PowerShell helper for windows, mouse, keyboard, audio
src/renderer/      chat, orb, overlay, settings
src/preload/       the only bridge between UI and main process
vendor/whisper/    whisper.cpp (MIT) with the Visual C++ runtime
test/              node --test
```

```powershell
npm test                                                   # tests
npm run release -- korrektur "Blase startet jetzt ausgeschaltet"
npm run release -- funktion  "Julia liest jetzt Termine vor"
```

The release script runs the tests and `npm audit` first and stops if anything fails. Then it
sets the version, writes the changelog line, commits, tags, pushes, builds the installer and
attaches it to the GitHub release.

The screenshots in this README come from the demo mode with example data:

```powershell
$env:JULIA_DATEN = "$env:TEMP\julia-demo"; $env:JULIA_SCREENSHOTS = "docs\bilder"; npm start
```
</details>

## Limits

- Julia is a program, not a person – and not a doctor, lawyer or financial advisor.
- For answers she needs an AI provider; with Ollama or LM Studio that works entirely offline. Cloud providers cost credit.
- Speech recognition and voices run locally – on older PCs *Accurate* transcription takes a moment; choose *Fast* then. The natural voices are German.
- The Minecraft voice chat is a preview.

## License

Julia AI is under the [MIT license](LICENSE): you may use, change and share it as long as the
license and copyright notice stay intact. No warranty.

Shipped with Julia: [whisper.cpp](https://github.com/ggml-org/whisper.cpp) (MIT). Downloaded
once, not shipped: Whisper models, [Piper](https://github.com/rhasspy/piper) and the voices
Thorsten and Kerstin (CC0).
