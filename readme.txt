TYLER'S EVIDENCE CARD AUTOMATION SYSTEM
========================================

QUICK START:
------------
1. Run setup.bat (one time only - installs packages)
2. Run run.bat to launch the program
3. Get your Gemini API key from: https://makersuite.google.com/app/apikey


FOLDER STRUCTURE:
-----------------
After first run, creates these folders in C:\Users\[YourName]\EvidenceCards\:

📁 EvidenceCards\
   📁 templates\      → Your prompt templates (prompt_revised.txt)
   📁 files\          → Stored evidence files (PDFs, screenshots)
   📁 exports\        → JSON and CSV exports for mail merge
   📄 api_key.txt     → Your saved Gemini API key


HOW THE TEMPLATE SYSTEM WORKS:
-------------------------------
The program uses PLACEHOLDERS in your prompt template:

{{VOICE_INSERT}}    → Replaced with your voice transcription/notes
{{FILES_LIST}}      → Replaced with list of uploaded files  
{{FILES_CONTENT}}   → Replaced with content from files

You can edit prompt_revised.txt to customize how Gemini processes your evidence!


WORKFLOW:
---------
1. LOAD TEMPLATE
   - Automatically loads prompt_revised.txt on startup
   - Click "Edit Template" to modify it
   - Click "Reload Template" after editing

2. ADD VOICE/TEXT
   - Click "Start Recording" for voice-to-text
   - OR type directly in the text box
   - This replaces {{VOICE_INSERT}} in template

3. ADD EVIDENCE FILES  
   - Click "Add Files" to upload PDFs/screenshots
   - Files are copied to storage (won't lose them!)
   - These replace {{FILES_LIST}} in template

4. PROCESS WITH GEMINI
   - Click "Process with Gemini"
   - Sends template + your inputs to AI
   - Generates 1-3 evidence cards

5. EXPORT RESULTS
   - Export JSON - Full card data for processing
   - Export CSV - Ready for Word mail merge
   - Files saved with timestamps


TIPS:
-----
• You can load a prompt template by selecting any .txt file with "prompt" in the name
• The program saves your API key so you don't need to re-enter it
• All files are stored locally - no browser storage limits!
• CSV includes full file paths for mail merge integration
• Edit the template to add specific instructions for your case


LOADING YOUR CUSTOM PROMPT:
---------------------------
Option 1: Edit the existing template
   - Click "Edit Template" button
   - Modify prompt_revised.txt
   - Click "Reload Template"

Option 2: Load a different template
   - Click "Add Files"
   - Select your custom prompt_something.txt file
   - Choose "Yes" to use as template

Option 3: Direct replacement
   - Put your template in: C:\Users\[YourName]\EvidenceCards\templates\
   - Name it prompt_revised.txt (overwrites default)
   - Restart program


MAIL MERGE SETUP:
-----------------
1. Export CSV from the program
2. Open Word mail merge
3. Select the CSV as data source
4. Insert merge fields for:
   - UID, Location, Date, Time
   - Claim, Element
   - D1_Gunnarson through D9_Doe2 (parties)
   - Description, Quote, Significance
   - Caselaw1, Caselaw2
   - Source, Citation, Notes
   - Screenshot_Path (link to evidence file)


TROUBLESHOOTING:
----------------
"Microphone not working"
→ Make sure Chrome/Edge has mic permissions
→ Check Windows privacy settings for microphone

"Gemini API error"
→ Check your API key is correct
→ Make sure you have API credits
→ Try with smaller files first

"Can't parse JSON"
→ Check your template ends with clear JSON instructions
→ Make sure template asks for JSON array format
→ Reduce number of cards requested (try 1 instead of 3)


CONTACT:
--------
Built for Tyler Lofall's case documentation
No mock data, no BS, just real automation that works!