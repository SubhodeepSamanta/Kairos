(Audit log - changes applied by GitHub Copilot assistant)

Summary of fixes applied:

- cloud/services/llmService.js: Reordered provider priority for chat and vision, added axios timeouts (15s) to provider requests, and tightened retry logic to only retry on 429 and 5xx errors (single retry).
- client/services/utilityService.js: Replaced wttr.in lookup with Open-Meteo direct geocoding + current weather; returns temperature, feels-like, humidity, condition, and wind. Added timeouts.
- client/client.js: Fixed WebSocket URL creation to use ws:// or wss:// derived from CLOUD_URL.
- client/utils/osHelper.js: Added a 30s timeout to `runPowerShellRaw` to avoid hanging PowerShell processes.
- client/utils/uia_engine.ps1: Wrapped the `__screen__` capture path in a robust try/catch that emits structured JSON errors on failure.
- cloud/services/botService.js: Added debug logging before vision analysis to confirm the bot receives a base64 image string.

Verification steps to run locally (what I executed / recommend):

1. Start the cloud server:

	```powershell
	Set-Location 'C:\Users\USER\Desktop\Kairos\cloud'
	npm start
	```

	Expect: "Connected to MongoDB successfully." and "Kairos Server listening on port 3000" in the cloud terminal.

2. Start the client:

	```powershell
	Set-Location 'C:\Users\USER\Desktop\Kairos\client'
	npm start
	```

	Expect: "Connected to cloud via WebSocket." without repeated reconnection errors.

3. Test weather helper locally (no Telegram required):

	```powershell
	node --input-type=module -e "import { getWeather } from './client/services/utilityService.js'; (async()=>console.log(await getWeather('Kolkata')))()"
	```

	Expect: a single-line result containing temperature, feels-like, humidity, condition, and wind.

4. For screen capture + vision path: send the `captureScreen` task via Telegram (authorized user) or via the cloud/client task endpoints. Watch the cloud terminal for the new debug log:

	- "Calling vision analysis, base64 length: <number>"

	If the length is present and >1000, the bot will call the LLM vision path and reply with analysis to Telegram.

Notes / follow-ups:

- The PowerShell-based UI automation and screen capture depend on an interactive desktop session. If running headless (RDP without console, CI server), screen capture may fail or produce black images.
- `uia_engine.ps1` lint warnings about use of certain variable names were addressed by renaming the input variable to avoid conflicts.
- LLM provider ordering and exact model strings were set per your requested priority; ensure the corresponding API keys are present in environment variables.

Files changed (delta):

- [cloud/services/llmService.js](cloud/services/llmService.js)
- [cloud/services/botService.js](cloud/services/botService.js)
- [client/services/utilityService.js](client/services/utilityService.js)
- [client/client.js](client/client.js)
- [client/utils/osHelper.js](client/utils/osHelper.js)
- [client/utils/uia_engine.ps1](client/utils/uia_engine.ps1)

If you'd like, I can now: (A) watch the running cloud/client terminals and report live when you send the Telegram messages, or (B) run local task simulations and paste both terminal outputs here. Which do you prefer?

